export const mockAuthAPI = {
  login: async (
    email: string,
    password: string,
    stayLoggedIn: boolean
  ): Promise<{
    success: boolean;
    token?: string;
    isAdmin?: boolean;
    error?: string;
  }> => {
    console.log("[MockAPI] Login attempt:", email, stayLoggedIn);
    if (email === "Admin" && password === "admin123") {
      return {
        success: true,
        token: "mock-admin-token-" + Date.now(),
        isAdmin: true,
      };
    }
    if (email && password) {
      return {
        success: true,
        token: "mock-token-" + Date.now(),
        isAdmin: false,
      };
    }
    return {
      success: false,
      error: "Invalid credentials",
    };
  },

  validateSession: async (
    token: string
  ): Promise<{ valid: boolean; email?: string; isAdmin?: boolean }> => {
    console.log("[MockAPI] Validating session:", token);
    if (token?.startsWith("mock-")) {
      return {
        valid: true,
        email: "developer@company.com",
        isAdmin: token.includes("admin"),
      };
    }
    return {
      valid: false,
    };
  },

  logout: async (
    token: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.log("[MockAPI] Logout:", token);
    return {
      success: true,
    };
  },

  getCurrentSession: async (
    token: string
  ): Promise<{ email: string; token: string; isAdmin: boolean } | null> => {
    console.log("[MockAPI] Getting current session:", token);
    if (token?.startsWith("mock-")) {
      return {
        email: "developer@company.com",
        token,
        isAdmin: token.includes("admin"),
      };
    }
    return null;
  },
};
