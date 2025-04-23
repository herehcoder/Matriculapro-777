import { apiRequest } from "./queryClient";

// Authentication
export const loginUser = (email: string, password: string, role: string) => {
  return apiRequest("POST", "/api/auth/login", { email, password, role });
};

export const logoutUser = () => {
  return apiRequest("POST", "/api/auth/logout");
};

export const getCurrentUser = () => {
  return fetch("/api/auth/me", { credentials: "include" })
    .then(res => {
      if (!res.ok) {
        if (res.status === 401) {
          return null;
        }
        throw new Error("Failed to fetch current user");
      }
      return res.json();
    });
};

export const registerUser = (userData: any) => {
  return apiRequest("POST", "/api/auth/register", userData);
};

// Schools
export const getSchools = () => {
  return fetch("/api/schools", { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch schools");
    return res.json();
  });
};

export const getSchool = (id: number) => {
  return fetch(`/api/schools/${id}`, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch school");
    return res.json();
  });
};

export const createSchool = (schoolData: any) => {
  return apiRequest("POST", "/api/schools", schoolData);
};

export const updateSchool = (id: number, schoolData: any) => {
  return apiRequest("PUT", `/api/schools/${id}`, schoolData);
};

// Leads
export const getLeads = (schoolId?: number) => {
  const url = schoolId ? `/api/leads?schoolId=${schoolId}` : "/api/leads";
  return fetch(url, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch leads");
    return res.json();
  });
};

export const createLead = (leadData: any) => {
  return apiRequest("POST", "/api/leads", leadData);
};

export const updateLead = (id: number, leadData: any) => {
  return apiRequest("PUT", `/api/leads/${id}`, leadData);
};

// Courses
export const getCourses = (schoolId?: number) => {
  const url = schoolId ? `/api/courses?schoolId=${schoolId}` : "/api/courses";
  return fetch(url, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch courses");
    return res.json();
  });
};

export const getCoursesBySchool = (schoolId: number) => {
  return fetch(`/api/courses?schoolId=${schoolId}`, { credentials: "include" })
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch courses for school");
      return res.json();
    });
};

export const createCourse = (courseData: any) => {
  return apiRequest("POST", "/api/courses", courseData);
};

// Enrollments
export const getEnrollments = (
  schoolId?: number, 
  status?: string, 
  page?: number,
  limit?: number,
  sortField?: string,
  sortDirection?: string
) => {
  let url = "/api/enrollments";
  const params = new URLSearchParams();
  
  if (schoolId) params.append("schoolId", schoolId.toString());
  if (status && status !== 'all') params.append("status", status);
  if (page) params.append("page", page.toString());
  if (limit) params.append("limit", limit.toString());
  if (sortField) params.append("sortField", sortField);
  if (sortDirection) params.append("sortDirection", sortDirection);
  
  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;
  
  return fetch(url, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch enrollments");
    return res.json();
  });
};

export const getEnrollment = (id: number) => {
  return fetch(`/api/enrollments/${id}`, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch enrollment");
    return res.json();
  });
};

export const getStudentEnrollments = () => {
  return fetch("/api/enrollments/student", { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch student enrollments");
    return res.json();
  });
};

export const createEnrollment = (enrollmentData: any) => {
  return apiRequest("POST", "/api/enrollments", enrollmentData);
};

export const updateEnrollment = (id: number, enrollmentData: any) => {
  return apiRequest("PUT", `/api/enrollments/${id}`, enrollmentData);
};

export const completeEnrollmentStep = (id: number, step: string, data: any) => {
  return apiRequest("POST", `/api/enrollments/${id}/steps/${step}`, data);
};

// Form Questions
export const getQuestions = (schoolId: number, section?: string) => {
  let url = `/api/questions?schoolId=${schoolId}`;
  if (section) url += `&section=${section}`;
  
  return fetch(url).then(res => {
    if (!res.ok) throw new Error("Failed to fetch questions");
    return res.json();
  });
};

export const getQuestionsBySchool = (schoolId: number, section?: string) => {
  let url = `/api/questions?schoolId=${schoolId}`;
  if (section) url += `&section=${section}`;
  
  return fetch(url, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch questions for school");
    return res.json();
  });
};

export const createQuestion = (questionData: any) => {
  return apiRequest("POST", "/api/questions", questionData);
};

export const updateQuestion = (id: number, questionData: any) => {
  return apiRequest("PUT", `/api/questions/${id}`, questionData);
};

export const deleteQuestion = (id: number) => {
  return apiRequest("DELETE", `/api/questions/${id}`);
};

// Form Answers
export const getAnswers = (enrollmentId: number) => {
  return fetch(`/api/answers/${enrollmentId}`).then(res => {
    if (!res.ok) throw new Error("Failed to fetch answers");
    return res.json();
  });
};

export const createAnswer = (answerData: any) => {
  return apiRequest("POST", "/api/answers", answerData);
};

// Chat
export const getChatHistory = (schoolId: number, userId?: number, leadId?: number) => {
  let url = `/api/chat/${schoolId}`;
  if (userId) url += `?userId=${userId}`;
  if (leadId) url += `${userId ? "&" : "?"}leadId=${leadId}`;
  
  return fetch(url).then(res => {
    if (!res.ok) throw new Error("Failed to fetch chat history");
    return res.json();
  });
};

export const sendChatMessage = (messageData: any) => {
  return apiRequest("POST", "/api/chat", messageData);
};

// WhatsApp webhook (simulation)
export const sendWhatsAppMessage = (data: any) => {
  return apiRequest("POST", "/api/whatsapp/webhook", data);
};

// Dashboard Metrics
export const getDashboardMetrics = (schoolId?: number) => {
  const url = schoolId ? `/api/dashboard/metrics?schoolId=${schoolId}` : "/api/dashboard/metrics";
  return fetch(url, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch dashboard metrics");
    return res.json();
  });
};

export const getRecentSchools = () => {
  return fetch("/api/dashboard/recent-schools", { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch recent schools");
    return res.json();
  });
};

// User Profile
export const getUser = (id: number) => {
  return fetch(`/api/users/${id}`, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  });
};

export const updateUserProfile = (id: number, userData: any) => {
  return apiRequest("PUT", `/api/users/${id}`, userData);
};

export const updatePassword = (id: number, passwordData: any) => {
  return apiRequest("PUT", `/api/users/${id}/password`, passwordData);
};
