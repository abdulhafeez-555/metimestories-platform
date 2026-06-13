import { FastifyInstance } from 'fastify';
import { query } from '../db';
import { requireParent } from '../middleware/auth';

// ─────────────────────────────────────────────────────────────
//  DPF ENGINE
// ─────────────────────────────────────────────────────────────

function replacePlaceholders(content: string, profile: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(profile)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    result = result.replace(regex, value);
  }
  return result;
}

function applyAgeVariant(content: string, ageBand: string, variants: any[]): string {
  const fullOverride = variants.find(
    (v: any) => v.age_band === ageBand && v.override_type === 'full'
  );
  if (fullOverride) return fullOverride.content;

  let result = content;

  const introOverride = variants.find(
    (v: any) => v.age_band === ageBand && v.override_type === 'intro'
  );
  if (introOverride) {
    result = result.replace(/\[INTRO\]([\s\S]*?)\[\/INTRO\]/gi, introOverride.content);
  }

  const climaxOverride = variants.find(
    (v: any) => v.age_band === ageBand && v.override_type === 'climax'
  );
  if (climaxOverride) {
    result = result.replace(/\[CLIMAX\]([\s\S]*?)\[\/CLIMAX\]/gi, climaxOverride.content);
  }

  const endingOverride = variants.find(
    (v: any) => v.age_band === ageBand && v.override_type === 'ending'
  );
  if (endingOverride) {
    result = result.replace(/\[ENDING\]([\s\S]*?)\[\/ENDING\]/gi, endingOverride.content);
  }

  const vocabOverride = variants.find(
    (v: any) => v.age_band === ageBand && v.override_type === 'vocab'
  );
  if (vocabOverride) {
    try {
      const vocabMap = JSON.parse(vocabOverride.content);
      for (const [word, replacement] of Object.entries(vocabMap)) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        result = result.replace(regex, replacement as string);
      }
    } catch (e) {
      console.error('Failed to parse vocab override:', e);
    }
  }

  result = result.replace(/\[(INTRO|CLIMAX|ENDING|\/INTRO|\/CLIMAX|\/ENDING)\]/gi, '');

  return result;
}

function splitIntoScenes(content: string, sceneCount: number): string[] {
  // Split by [SCENE] markers
  const sceneMarkers = content.split(/\[SCENE\]/gi).map(s => s.trim()).filter(s => s.length > 0);

  if (sceneMarkers.length >= 2) {
    return sceneMarkers.slice(0, sceneCount);
  }

  // Fallback: split by paragraphs
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);
  if (paragraphs.length >= sceneCount) {
    const perScene = Math.ceil(paragraphs.length / sceneCount);
    const scenes: string[] = [];
    for (let i = 0; i < sceneCount; i++) {
      const start = i * perScene;
      scenes.push(paragraphs.slice(start, start + perScene).join('\n\n'));
    }
    return scenes;
  }

  return paragraphs.length > 0 ? paragraphs : [content];
}

function cleanContent(content: string): string {
  // Remove all [SCENE] markers — frontend never sees these
  return content
    .replace(/\[SCENE\]/gi, '')
    .replace(/\[(INTRO|CLIMAX|ENDING|\/INTRO|\/CLIMAX|\/ENDING)\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildHeroDescription(appearance: any, profile: Record<string, string>): string {
  const parts: string[] = [];

  if (appearance?.gender_expression) {
    parts.push(appearance.gender_expression === 'girl' ? 'young girl' : 'young boy');
  } else {
    parts.push('young child');
  }

  if (appearance?.skin_tone) parts.push(`${appearance.skin_tone.replace(/_/g, ' ')} skin`);
  if (appearance?.hair_colour && appearance?.hair_type) {
    parts.push(`${appearance.hair_colour.replace(/_/g, ' ')} ${appearance.hair_type} hair`);
  }
  if (profile?.favourite_colour) parts.push(`wearing ${profile.favourite_colour} clothing`);

  return parts.join(', ');
}

function getIllustrationStyle(ageBand: string): string {
  const styles: Record<string, string> = {
    little: 'soft watercolour illustration, very simple shapes, bright primary colours, large friendly characters',
    young: "children's book illustration, warm watercolour, friendly characters, detailed backgrounds",
    middle: "detailed children's book illustration, rich watercolour, expressive characters",
    older: "detailed illustrated children's story, rich colours, dynamic composition, expressive",
  };
  return styles[ageBand] || styles.young;
}

function buildImagePrompts(
  scenes: string[],
  profile: Record<string, string>,
  appearance: any,
  ageBand: string
): string[] {
  const heroDescription = buildHeroDescription(appearance, profile);
  const style = getIllustrationStyle(ageBand);

  return scenes.map((scene) => {
    const sceneText = scene.replace(/\n/g, ' ').substring(0, 200);
    return `${style}, ${heroDescription}, scene: ${sceneText}, children's book illustration, warm colours, safe for children`;
  });
}

// ─────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────

export async function storyGenerationRoutes(fastify: FastifyInstance) {

  // POST /api/story-generation
  fastify.post('/', { preHandler: requireParent }, async (request, reply) => {
    const parent = request.user as any;
    const { child_id, story_id, queue_video = true } = request.body as any;

    if (!child_id || !story_id) {
      return reply.status(400).send({ error: 'child_id and story_id are required' });
    }

    // 1. Get child
    const childResult = await query(
      `SELECT c.id, c.name, c.appearance_profile,
       DATE_PART('year', AGE(c.date_of_birth))::INTEGER as age,
       CASE
         WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 3 AND 4 THEN 'little'
         WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 5 AND 6 THEN 'young'
         WHEN DATE_PART('year', AGE(c.date_of_birth)) BETWEEN 7 AND 8 THEN 'middle'
         ELSE 'older'
       END as age_band
       FROM children c
       WHERE c.id = $1 AND c.parent_id = $2 AND c.deleted_at IS NULL`,
      [child_id, parent.parentId]
    );

    if (childResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Child not found' });
    }

    const child = childResult.rows[0];

    // 2. Get story
    const storyResult = await query(
      `SELECT s.id, s.title, s.content, s.scene_count,
              s.reading_time_mins, s.age_adaptive,
              s.current_version, s.discussion_prompts,
              s.outcome_focus,
              sv.label as value_label,
              sv.value_key, sv.colour_hex as value_colour
       FROM stories s
       LEFT JOIN story_values sv ON sv.id = s.value_id
       WHERE s.id = $1 AND s.status = 'published'`,
      [story_id]
    );

    if (storyResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Story not found' });
    }

    const story = storyResult.rows[0];

    // 3. Get child profile data
    const profileResult = await query(
      `SELECT pf.field_key, cpd.value
       FROM child_profile_data cpd
       JOIN personalization_fields pf ON pf.id = cpd.field_id
       WHERE cpd.child_id = $1`,
      [child_id]
    );

    const profile: Record<string, string> = {};
    profileResult.rows.forEach((row: any) => {
      profile[row.field_key] = row.value;
    });

    profile['child_name'] = child.name;
    profile['child_age'] = child.age.toString();

    // 4. Check missing required fields
    const requiredFieldsResult = await query(
      `SELECT pf.field_key, pf.label
       FROM story_fields sf
       JOIN personalization_fields pf ON pf.id = sf.field_id
       WHERE sf.story_id = $1 AND sf.required = true`,
      [story_id]
    );

    const missingFields = requiredFieldsResult.rows
      .filter((f: any) => !profile[f.field_key])
      .map((f: any) => ({ key: f.field_key, label: f.label }));

    if (missingFields.length > 0) {
      return reply.status(422).send({
        error: 'Missing required personalisation fields',
        missing_fields: missingFields,
        message: `Please complete ${child.name}'s profile before generating this story.`,
      });
    }

    // 5. Get age variants
    let ageVariants: any[] = [];
    if (story.age_adaptive) {
      const variantsResult = await query(
        'SELECT age_band, override_type, content FROM story_age_variants WHERE story_id = $1',
        [story_id]
      );
      ageVariants = variantsResult.rows;
    }

    // 6. Apply DPF
    let personalisedContent = story.content;
    if (story.age_adaptive && ageVariants.length > 0) {
      personalisedContent = applyAgeVariant(personalisedContent, child.age_band, ageVariants);
    }
    personalisedContent = replacePlaceholders(personalisedContent, profile);

    // 7. Split into scenes BEFORE cleaning
    const scenes = splitIntoScenes(personalisedContent, story.scene_count || 10);

    // 8. Clean content — remove ALL markers before returning to frontend
    const cleanStoryContent = cleanContent(personalisedContent);

    // 9. Build image prompts
    const appearance = child.appearance_profile || {};
    const imagePrompts = buildImagePrompts(scenes, profile, appearance, child.age_band);

    // 10. Personalise title
    const personalisedTitle = replacePlaceholders(story.title, profile);

    // 11. Build pipeline payload
    const pipelinePayload = {
      child: {
        id: child.id,
        name: child.name,
        age: child.age,
        age_band: child.age_band,
        appearance_profile: appearance,
      },
      story: {
        id: story.id,
        personalised_title: personalisedTitle,
        value: story.value_key,
        value_colour: story.value_colour,
        reading_time_mins: story.reading_time_mins,
        version: story.current_version,
      },
      scenes: scenes.map((scene, index) => ({
        scene_number: index + 1,
        content: scene.trim(),
        image_prompt: imagePrompts[index],
      })),
    };

    // 12. Queue video job
    let videoJob = null;
    if (queue_video) {
      const existingJob = await query(
        'SELECT id, status, video_url FROM video_jobs WHERE child_id = $1 AND story_id = $2',
        [child_id, story_id]
      );

      if (existingJob.rows.length > 0 && existingJob.rows[0].status === 'done') {
        videoJob = {
          id: existingJob.rows[0].id,
          status: 'done',
          video_url: existingJob.rows[0].video_url,
          cached: true
        };
      } else {
        let jobResult;
        if (existingJob.rows.length > 0) {
          jobResult = await query(
            `UPDATE video_jobs
             SET status = 'queued', age_band_used = $1,
                 story_version_at_generation = $2,
                 queued_at = NOW(), started_at = NULL,
                 completed_at = NULL, video_url = NULL, error_message = NULL
             WHERE child_id = $3 AND story_id = $4 RETURNING id`,
            [child.age_band, story.current_version, child_id, story_id]
          );
        } else {
          jobResult = await query(
            `INSERT INTO video_jobs (child_id, story_id, age_band_used, story_version_at_generation, status)
             VALUES ($1, $2, $3, $4, 'queued') RETURNING id`,
            [child_id, story_id, child.age_band, story.current_version]
          );
        }

        const jobId = jobResult.rows[0].id;
        videoJob = { id: jobId, status: 'queued', cached: false };

        const pipelineUrl = process.env.PIPELINE_URL || 'http://localhost:8000';
        const webhookUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/webhook/video-complete`;

        fetch(`${pipelineUrl}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pipelinePayload, job_id: jobId, webhook_url: webhookUrl }),
        }).catch((err) => {
          console.error('Pipeline request failed:', err.message);
        });
      }
    }

    // 13. Return clean response — frontend never sees [SCENE] markers
    return reply.send({
      message: 'Story personalised successfully',
      child: {
        id: child.id,
        name: child.name,
        age: child.age,
        age_band: child.age_band,
      },
      story: {
        id: story.id,
        original_title: story.title,
        personalised_title: personalisedTitle,
        value: story.value_label,
        value_colour: story.value_colour,
        outcome_focus: story.outcome_focus,
        reading_time_mins: story.reading_time_mins,
      },
      // Clean story content — no markers, ready for frontend display
      story_content: cleanStoryContent,
      // Individual scenes for pipeline — clean text + image prompt
      scenes: pipelinePayload.scenes,
      discussion_prompts: story.discussion_prompts,
      video_job: videoJob,
    });
  });

}
