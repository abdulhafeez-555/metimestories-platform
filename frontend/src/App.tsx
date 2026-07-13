import { Switch, Route } from "wouter";
import { FamilyAuthProvider } from "@/context/FamilyAuthContext";
import { ChildNameProvider } from "@/contexts/ChildNameContext";

import MarketingHome from "@/pages/MarketingHome";
import ForAuthors from "@/pages/ForAuthors";
import StaffLogin from "@/pages/StaffLogin";
import StaffQueue from "@/pages/StaffQueue";
import StaffReviewDetail from "@/pages/StaffReviewDetail";
import ParentRegister from "@/pages/family/ParentRegister";
import ParentLogin from "@/pages/family/ParentLogin";
import ParentDashboard from "@/pages/family/ParentDashboard";
import AddChild from "@/pages/family/AddChild";
import EditChildProfile from "@/pages/family/EditChildProfile";
import ChildPinLogin from "@/pages/family/ChildPinLogin";
import StoryLibrary from "@/pages/family/StoryLibrary";
import FamilyStoryReader from "@/pages/family/FamilyStoryReader";

import AuthorLogin from "@/pages/author/AuthorLogin";
import AuthorRegister from "@/pages/author/AuthorRegister";
import DashboardPage from "@/pages/DashboardPage";
import EditorPage from "@/pages/EditorPage";
import FieldsPage from "@/pages/FieldsPage";
import VariantsPage from "@/pages/VariantsPage";
import PreviewPage from "@/pages/PreviewPage";

function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/40">
      Page not found.
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={MarketingHome} />
      <Route path="/for-authors" component={ForAuthors} />
      <Route path="/staff/login" component={StaffLogin} />
      <Route path="/staff/reviews" component={StaffQueue} />
      <Route path="/staff/reviews/:storyId" component={StaffReviewDetail} />

      <Route path="/family/register" component={ParentRegister} />
      <Route path="/family/login" component={ParentLogin} />
      <Route path="/family/dashboard" component={ParentDashboard} />
      <Route path="/family/add-child" component={AddChild} />
      <Route path="/family/child/:childId/profile" component={EditChildProfile} />
      <Route path="/family/child-login" component={ChildPinLogin} />
      <Route path="/family/stories" component={StoryLibrary} />
      <Route path="/family/story/:storyId" component={FamilyStoryReader} />

      <Route path="/author/login" component={AuthorLogin} />
      <Route path="/author/register" component={AuthorRegister} />
      <Route path="/author/dashboard" component={DashboardPage} />
      <Route path="/author/stories/new" component={EditorPage} />
      <Route path="/author/stories/:storyId/edit" component={EditorPage} />
      <Route path="/author/fields" component={FieldsPage} />
      <Route path="/author/stories/:storyId/variants" component={VariantsPage} />
      <Route path="/author/stories/:storyId/preview" component={PreviewPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ChildNameProvider>
      <FamilyAuthProvider>
        <Router />
      </FamilyAuthProvider>
    </ChildNameProvider>
  );
}







