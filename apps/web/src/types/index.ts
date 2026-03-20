// src/types/index.ts

export type Role = "ADMIN" | "BARBER" | "CLIENT";

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type CommandStatus = "OPEN" | "CLOSED";
export type PaymentMethod = "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  avatarUrl?: string | null;
  barberProfileId?: string | null;
  barberProfile?: {
    id: string;
    commissionRate: number;
    isAvailable: boolean;
  } | null;
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  duration: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export interface BarberProfile {
  id: string;
  userId: string;
  bio?: string | null;
  commissionRate: number;
  isAvailable: boolean;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  schedules: BarberSchedule[];
}

export interface BarberSchedule {
  id: string;
  barberProfileId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isActive: boolean;
}

export interface Appointment {
  id: string;
  clientId: string;
  barberProfileId: string;
  serviceId: string;
  scheduledAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  client?: Pick<User, "id" | "name" | "phone">;
  barberProfile?: BarberProfile;
  service?: Service;
  comanda?: {
    id: string;
    status: CommandStatus;
    paymentStatus: PaymentStatus;
  } | null;
}

export interface Comanda {
  id: string;
  appointmentId: string;
  status: CommandStatus;
  totalAmount: number;
  paymentMethod?: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  paidAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  appointment: Appointment;
  commission?: Commission | null;
}

export interface Commission {
  id: string;
  barberProfileId: string;
  comandaId: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  isPaid: boolean;
  paidAt?: string | null;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface AvailabilityResponse {
  slots: string[];
  date: string;
  barberId: string;
  serviceId: string;
}

export interface DashboardStats {
  today: { appointments: number; openComandas: number };
  month: { appointments: number; revenue: number };
  totals: { clients: number; barbers: number; pendingCommissions: number };
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

export const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  PENDING: "badge-pending",
  CONFIRMED: "badge-confirmed",
  IN_PROGRESS: "badge-progress",
  COMPLETED: "badge-completed",
  CANCELLED: "badge-cancelled",
  NO_SHOW: "badge-noshow",
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Segunda",
  TUESDAY: "Terça",
  WEDNESDAY: "Quarta",
  THURSDAY: "Quinta",
  FRIDAY: "Sexta",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de Crédito",
  DEBIT_CARD: "Cartão de Débito",
};
