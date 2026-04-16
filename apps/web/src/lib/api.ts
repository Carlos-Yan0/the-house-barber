// src/lib/api.ts
import axios, { type AxiosInstance } from "axios";
import { useAuthStore } from "@/store/authStore";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
let refreshRequest: Promise<string> | null = null;

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();

      if (!refreshToken) { logout(); return Promise.reject(error); }

      try {
        if (!refreshRequest) {
          refreshRequest = axios
            .post(`${BASE_URL}/auth/refresh`, { refreshToken })
            .then(({ data }) => data.token as string)
            .finally(() => {
              refreshRequest = null;
            });
        }

        const nextToken = await refreshRequest;
        setTokens(nextToken, refreshToken);
        original.headers.Authorization = `Bearer ${nextToken}`;
        return api(original);
      } catch {
        logout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login:    (email: string, password: string) => api.post("/auth/login", { email, password }),
  register: (data: { name: string; email: string; phone?: string; password: string }) =>
    api.post("/auth/register", data),
  logout:        (refreshToken: string) => api.post("/auth/logout", { refreshToken }),
  me:            () => api.get("/auth/me"),
  forgotPassword:(email: string) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) => api.post("/auth/reset-password", { token, password }),
};

export const servicesApi = {
  list:   (all?: boolean)             => api.get("/services", { params: all ? { all: "true" } : {} }),
  get:    (id: string)                => api.get(`/services/${id}`),
  create: (data: unknown)             => api.post("/services", data),
  update: (id: string, data: unknown) => api.put(`/services/${id}`, data),
  delete: (id: string)                => api.delete(`/services/${id}`),
};

export const barbersApi = {
  list:               ()                                                         => api.get("/barbers"),
  get:                (id: string)                                               => api.get(`/barbers/${id}`),
  getSchedule:        (id: string)                                               => api.get(`/barbers/${id}/schedule`),
  updateSchedule:     (id: string, schedules: unknown[])                         => api.put(`/barbers/${id}/schedule`, { schedules }),
  blockDate:          (id: string, date: string, reason?: string)                => api.post(`/barbers/${id}/blocked-dates`, { date, reason }),
  unblockDate:        (id: string, dateId: string)                               => api.delete(`/barbers/${id}/blocked-dates/${dateId}`),
  getEarnings:        (id: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/barbers/${id}/earnings`, { params }),
  updateAvailability: (id: string, isAvailable: boolean)                         => api.patch(`/barbers/${id}/availability`, { isAvailable }),
};

export const appointmentsApi = {
  list: (params?: { page?: number; limit?: number; date?: string; status?: string }) =>
    api.get("/appointments", { params }),

  create: (data: {
    barberProfileId: string;
    serviceId:       string;
    scheduledAt:     string;
    paymentMethod:   "CASH" | "PIX";
    clientNameOverride?: string;
    notes?:          string;
  }) => api.post("/appointments", data),

  updateStatus: (id: string, status: string, cancelReason?: string) =>
    api.patch(`/appointments/${id}/status`, { status, cancelReason }),

  cancel: (id: string) => api.delete(`/appointments/${id}`),

  getAvailability: (barberId: string, date: string, serviceId: string) =>
    api.get("/appointments/availability", { params: { barberId, date, serviceId } }),
};

export const paymentsApi = {
  pixStatus: (appointmentId: string) => api.get(`/payments/pix/status/${appointmentId}`),
};

export const comandasApi = {
  list:  (status?: string)                    => api.get("/comandas", { params: status ? { status } : {} }),
  get:   (id: string)                         => api.get(`/comandas/${id}`),
  close: (id: string, paymentMethod: string)  => api.patch(`/comandas/${id}/close`, { paymentMethod }),
};

export const adminApi = {
  dashboard:    (date?: string)                               => api.get("/admin/dashboard", { params: date ? { date } : {} }),
  revenue:      (params?: { start?: string; end?: string })  => api.get("/admin/reports/revenue", { params }),
  createBarber: (data: unknown)                              => api.post("/admin/barbers", data),
  listUsers:    (role?: string)                              => api.get("/admin/users", { params: role ? { role } : {} }),
  payCommission:(id: string)                                 => api.patch(`/admin/commissions/${id}/pay`, {}),
  updateBarber: (
    id: string,
    data: { name?: string; email?: string; phone?: string; commissionRate?: number }
  ) => api.patch(`/admin/barbers/${id}`, data),
  toggleUserActive: (id: string) => api.patch(`/admin/users/${id}/toggle-active`, {}),
};
