export interface DashboardResourceAllocation {
  id: string;
  appointmentId: string;
  resourceId: string;
  resourceName: string;
  startTime: string;
  endTime: string;
}

export interface DashboardAppointment {
  id: string;
  businessId: string;
  serviceId: string | null;
  serviceName: string | null;
  manualLabel: string | null;
  startTime: string;
  endTime: string;
  status: string;
  customerName: string;
  customerPhone: string;
  allocations?: DashboardResourceAllocation[];
}

export interface DashboardCreateAppointmentRequest {
  businessId: string;
  serviceId: string | null;
  startTime: string;
  endTime?: string;
  customerName: string;
  customerPhone: string;
  inputs: Record<string, number>;
  preferredResourceIds: string[];
  resourceIds?: string[];
  manualLabel?: string;
}
