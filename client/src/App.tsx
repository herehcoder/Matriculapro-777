import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import AdminDashboard from "@/pages/dashboard/admin";
import SchoolDashboard from "@/pages/dashboard/school";
import AttendantDashboard from "@/pages/dashboard/attendant";
import StudentDashboard from "@/pages/dashboard/student";
import EnrollmentPage from "@/pages/enrollment/index";
import EnrollmentSuccessPage from "@/pages/enrollment/success";
import PaymentSuccessPage from "@/pages/payment/success";
import ChatbotPage from "@/pages/chatbot/index";
import ChatPage from "@/pages/chat/index";
import SchoolsPage from "@/pages/schools/index";
import NewSchoolPage from "@/pages/schools/new";
import LeadsPage from "@/pages/leads/index";
import OnboardingPage from "@/pages/onboarding/index";
import EnrollmentsPage from "@/pages/enrollments/index";
import EnrollmentViewPage from "@/pages/enrollments/view";
import NewEnrollmentPage from "@/pages/enrollments/new";
import FormQuestionsPage from "@/pages/form-questions/index";
import CoursesPage from "@/pages/courses/index";
import NewCoursePage from "@/pages/courses/new";
import ExploreCoursesPage from "@/pages/courses/explore";
import MyEnrollmentsPage from "@/pages/my-enrollments/index";
import SupportPage from "@/pages/support/index";
import WhatsAppPage from "@/pages/whatsapp/index";
import AnalyticsPage from "@/pages/analytics/index";
import AccountPage from "@/pages/account";
import SettingsPage from "@/pages/settings";
import UsersList from "./pages/users/list";
import NewUser from "./pages/users/new";
import EditUserWithId from "./pages/users/edit/[id]";
import { useAuth, AuthProvider } from "./lib/auth";
import MainLayout from "./components/Layout/MainLayout";
import { Loader2 } from "lucide-react";

function Router() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando...</span>
      </div>
    );
  }
  
  // Public routes when not logged in
  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/enrollment/:schoolId/:enrollmentId?" component={EnrollmentPage} />
        <Route path="/enrollment/success/:id" component={EnrollmentSuccessPage} />
        <Route path="/payment/success" component={PaymentSuccessPage} />
        <Route component={Login} />
      </Switch>
    );
  }
  
  // Role-based routing within MainLayout when logged in
  return (
    <MainLayout>
      <Switch>
        {/* Admin Routes */}
        {user.role === "admin" && (
          <Route path="/" component={AdminDashboard} />
        )}
        
        {/* School Routes */}
        {user.role === "school" && (
          <Route path="/" component={SchoolDashboard} />
        )}
        
        {/* Attendant Routes */}
        {user.role === "attendant" && (
          <Route path="/" component={AttendantDashboard} />
        )}
        
        {/* Student Routes */}
        {user.role === "student" && (
          <Route path="/" component={StudentDashboard} />
        )}

        {/* Common authenticated routes */}
        <Route path="/dashboard/admin" component={AdminDashboard} />
        <Route path="/dashboard/school" component={SchoolDashboard} />
        <Route path="/dashboard/attendant" component={AttendantDashboard} />
        <Route path="/dashboard/student" component={StudentDashboard} />
        <Route path="/enrollment/:schoolId/:enrollmentId?" component={EnrollmentPage} />
        <Route path="/enrollment/success/:id" component={EnrollmentSuccessPage} />
        <Route path="/enrollment/continue/:enrollmentId" component={EnrollmentPage} />
        <Route path="/payment/success" component={PaymentSuccessPage} />
        <Route path="/enrollments" component={EnrollmentsPage} />
        <Route path="/enrollments/new" component={NewEnrollmentPage} />
        <Route path="/enrollments/:enrollmentId" component={EnrollmentViewPage} />
        <Route path="/form-questions" component={FormQuestionsPage} />
        <Route path="/chatbot" component={ChatbotPage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/schools" component={SchoolsPage} />
        <Route path="/schools/new" component={NewSchoolPage} />
        <Route path="/leads" component={LeadsPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/courses" component={CoursesPage} />
        <Route path="/courses/new" component={NewCoursePage} />
        <Route path="/courses/explore" component={ExploreCoursesPage} />
        <Route path="/my-enrollments" component={MyEnrollmentsPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/whatsapp" component={WhatsAppPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/users" component={UsersList} />
        <Route path="/users/new" component={NewUser} />
        <Route path="/users/edit/:id" component={EditUserWithId} />
        
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Router />
      </AuthProvider>
    </TooltipProvider>
  );
}

export default App;
