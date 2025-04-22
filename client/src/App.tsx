import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AdminDashboard from "@/pages/dashboard/admin";
import SchoolDashboard from "@/pages/dashboard/school";
import AttendantDashboard from "@/pages/dashboard/attendant";
import StudentDashboard from "@/pages/dashboard/student";
import EnrollmentPage from "@/pages/enrollment/index";
import ChatbotPage from "@/pages/chatbot/index";
import SchoolsPage from "@/pages/schools/index";
import NewSchoolPage from "@/pages/schools/new";
import LeadsPage from "@/pages/leads/index";
import OnboardingPage from "@/pages/onboarding/index";
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
        <Route path="/enrollment/:schoolId/:enrollmentId?" component={EnrollmentPage} />
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
        <Route path="/chatbot" component={ChatbotPage} />
        <Route path="/schools" component={SchoolsPage} />
        <Route path="/schools/new" component={NewSchoolPage} />
        <Route path="/leads" component={LeadsPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        
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
