import type { Credential } from "./api-fallback.types";
import { mockCredentials } from "./api-fallback.data";

export const mockCredentialsAPI = {
  store: async (
    service: string,
    email: string,
    _password: string
  ): Promise<{ success: boolean; message: string; changes: number }> => {
    console.log("[MockAPI] Storing credentials:", service, email);
    return {
      success: true,
      message: "Credentials stored successfully",
      changes: 1,
    };
  },

  list: async (): Promise<{
    success: boolean;
    credentials: Credential[];
    error?: string;
  }> => {
    console.log("[MockAPI] Listing credentials");
    return {
      success: true,
      credentials: mockCredentials,
    };
  },

  delete: async (
    service: string
  ): Promise<{ success: boolean; message: string; changes: number }> => {
    console.log("[MockAPI] Deleting credentials for:", service);
    return {
      success: true,
      message: "Credentials deleted successfully",
      changes: 1,
    };
  },
};
