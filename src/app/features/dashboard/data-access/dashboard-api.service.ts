import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { backendConfig } from '../../../core/config/backend.config';
import {
  DashboardBusiness,
  DashboardCreateBusinessRequest,
  DashboardUpdateBusinessRequest
} from '../models/dashboard-business.model';
import {
  DashboardCreateResourceAttributeDefinitionRequest,
  DashboardCreateResourceRequest,
  DashboardCreateResourceTypeRequest,
  DashboardResource,
  DashboardResourceType,
  DashboardUpdateResourceRequest,
  DashboardUpdateResourceAttributeDefinitionRequest,
  DashboardUpdateResourceTypeRequest
} from '../models/dashboard-resource.model';
import {
  DashboardCreateServiceRequest,
  DashboardService,
  DashboardUpdateServiceRequest
} from '../models/dashboard-service.model';
import { DashboardAppointment, DashboardCreateAppointmentRequest } from '../models/dashboard-appointment.model';
import {
  DashboardAddServiceRequirementRequest,
  DashboardServiceRequirement,
  DashboardUpdateServiceRequirementRequest
} from '../models/dashboard-service-requirement.model';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = backendConfig.baseUrl;

  getBusinesses(): Observable<DashboardBusiness[]> {
    return this.http.get<DashboardBusiness[]>(`${this.baseUrl}/api/businesses`);
  }

  createBusiness(request: DashboardCreateBusinessRequest): Observable<DashboardBusiness> {
    return this.http.post<DashboardBusiness>(`${this.baseUrl}/api/businesses`, request);
  }

  getBusiness(businessId: string): Observable<DashboardBusiness> {
    return this.http.get<DashboardBusiness>(`${this.baseUrl}/api/businesses/${businessId}`);
  }

  updateBusiness(businessId: string, request: DashboardUpdateBusinessRequest): Observable<DashboardBusiness> {
    return this.http.put<DashboardBusiness>(`${this.baseUrl}/api/businesses/${businessId}`, request);
  }

  removeBusiness(businessId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/businesses/${businessId}`);
  }

  getServices(businessId: string): Observable<DashboardService[]> {
    const params = new HttpParams().set('businessId', businessId);
    return this.http.get<DashboardService[]>(`${this.baseUrl}/api/services`, { params });
  }

  createService(businessId: string, request: DashboardCreateServiceRequest): Observable<DashboardService> {
    const params = new HttpParams().set('businessId', businessId);
    return this.http.post<DashboardService>(`${this.baseUrl}/api/services`, request, { params });
  }

  getService(serviceId: string): Observable<DashboardService> {
    return this.http.get<DashboardService>(`${this.baseUrl}/api/services/${serviceId}`);
  }

  updateService(serviceId: string, request: DashboardUpdateServiceRequest): Observable<DashboardService> {
    return this.http.put<DashboardService>(`${this.baseUrl}/api/services/${serviceId}`, request);
  }

  addServiceRequirement(
    serviceId: string,
    request: DashboardAddServiceRequirementRequest
  ): Observable<DashboardService> {
    return this.http.post<DashboardService>(`${this.baseUrl}/api/services/${serviceId}/requirements`, request);
  }

  removeService(serviceId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/services/${serviceId}`);
  }

  /** Every bookable start time for a service on a date -- backs the "first available slot" suggestions. */
  getAvailableStarts(
    serviceId: string,
    dateIso: string,
    preferredResourceIds: string[] = [],
    stepMinutes = 15,
    inputs: Record<string, number> = {}
  ): Observable<string[]> {
    let params = new HttpParams().set('date', dateIso).set('stepMinutes', stepMinutes);
    if (preferredResourceIds.length) {
      params = params.set('preferredResourceIds', preferredResourceIds.join(','));
    }
    for (const [key, value] of Object.entries(inputs)) {
      params = params.set(`input.${key}`, String(value));
    }
    return this.http.get<string[]>(`${this.baseUrl}/api/services/${serviceId}/available-starts`, { params });
  }

  getResourceTypes(businessId: string): Observable<DashboardResourceType[]> {
    const params = new HttpParams().set('businessId', businessId);
    return this.http.get<DashboardResourceType[]>(`${this.baseUrl}/api/resource-types`, { params });
  }

  createResourceType(
    businessId: string,
    request: DashboardCreateResourceTypeRequest
  ): Observable<DashboardResourceType> {
    const params = new HttpParams().set('businessId', businessId);
    return this.http.post<DashboardResourceType>(`${this.baseUrl}/api/resource-types`, request, { params });
  }

  updateResourceType(
    resourceTypeId: string,
    request: DashboardUpdateResourceTypeRequest
  ): Observable<DashboardResourceType> {
    return this.http.put<DashboardResourceType>(
      `${this.baseUrl}/api/resource-types/${resourceTypeId}`,
      request
    );
  }

  removeResourceType(resourceTypeId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/resource-types/${resourceTypeId}`);
  }

  createResourceAttributeDefinition(
    resourceTypeId: string,
    request: DashboardCreateResourceAttributeDefinitionRequest
  ): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/api/resource-types/${resourceTypeId}/attributes`, request);
  }

  updateResourceAttributeDefinition(
    resourceTypeId: string,
    attributeDefinitionId: string,
    request: DashboardUpdateResourceAttributeDefinitionRequest
  ): Observable<unknown> {
    return this.http.put<unknown>(
      `${this.baseUrl}/api/resource-types/${resourceTypeId}/attributes/${attributeDefinitionId}`,
      request
    );
  }

  removeResourceAttributeDefinition(resourceTypeId: string, attributeDefinitionId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/api/resource-types/${resourceTypeId}/attributes/${attributeDefinitionId}`
    );
  }

  getResources(businessId: string): Observable<DashboardResource[]> {
    const params = new HttpParams().set('businessId', businessId);
    return this.http.get<DashboardResource[]>(`${this.baseUrl}/api/resources`, { params });
  }

  createResource(businessId: string, request: DashboardCreateResourceRequest): Observable<DashboardResource> {
    const params = new HttpParams().set('businessId', businessId);
    return this.http.post<DashboardResource>(`${this.baseUrl}/api/resources`, request, { params });
  }

  getResource(resourceId: string): Observable<DashboardResource> {
    return this.http.get<DashboardResource>(`${this.baseUrl}/api/resources/${resourceId}`);
  }

  getResourceAvailability(resourceId: string): Observable<unknown> {
    return this.http.get<unknown>(`${this.baseUrl}/api/resources/${resourceId}/availability`);
  }

  addResourceAvailability(
    resourceId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Observable<unknown> {
    const params = new HttpParams()
      .set('date', date)
      .set('startTime', startTime)
      .set('endTime', endTime);
    return this.http.post<unknown>(`${this.baseUrl}/api/resources/${resourceId}/availability`, null, { params });
  }

  updateResourceAvailability(
    resourceId: string,
    availabilityId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Observable<unknown> {
    const params = new HttpParams()
      .set('date', date)
      .set('startTime', startTime)
      .set('endTime', endTime);
    return this.http.put<unknown>(
      `${this.baseUrl}/api/resources/${resourceId}/availability/${availabilityId}`,
      null,
      { params }
    );
  }

  removeResourceAvailability(resourceId: string, availabilityId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/resources/${resourceId}/availability/${availabilityId}`);
  }

  removeResource(resourceId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/resources/${resourceId}`);
  }

  updateResource(resourceId: string, request: DashboardUpdateResourceRequest): Observable<DashboardResource> {
    return this.http.put<DashboardResource>(`${this.baseUrl}/api/resources/${resourceId}`, request);
  }

  getAppointments(businessId: string): Observable<DashboardAppointment[]> {
    const params = new HttpParams().set('businessId', businessId);
    return this.http.get<DashboardAppointment[]>(`${this.baseUrl}/api/appointments`, { params });
  }

  getAppointmentsByService(serviceId: string): Observable<DashboardAppointment[]> {
    return this.http.get<DashboardAppointment[]>(`${this.baseUrl}/api/appointments/service/${serviceId}`);
  }

  getAppointmentsByResource(resourceId: string): Observable<DashboardAppointment[]> {
    return this.http.get<DashboardAppointment[]>(`${this.baseUrl}/api/appointments/resource/${resourceId}`);
  }

  getAppointment(appointmentId: string): Observable<DashboardAppointment> {
    return this.http.get<DashboardAppointment>(`${this.baseUrl}/api/appointments/${appointmentId}`);
  }

  createAppointment(request: DashboardCreateAppointmentRequest): Observable<DashboardAppointment> {
    return this.http.post<DashboardAppointment>(`${this.baseUrl}/api/appointments`, request);
  }

  confirmAppointment(appointmentId: string): Observable<DashboardAppointment> {
    return this.http.patch<DashboardAppointment>(`${this.baseUrl}/api/appointments/${appointmentId}/confirm`, null);
  }

  cancelAppointment(appointmentId: string): Observable<DashboardAppointment> {
    return this.http.patch<DashboardAppointment>(`${this.baseUrl}/api/appointments/${appointmentId}/cancel`, null);
  }

  completeAppointment(appointmentId: string): Observable<DashboardAppointment> {
    return this.http.patch<DashboardAppointment>(`${this.baseUrl}/api/appointments/${appointmentId}/complete`, null);
  }

  rescheduleAppointment(appointmentId: string, startTime: string, endTime: string): Observable<DashboardAppointment> {
    return this.http.patch<DashboardAppointment>(`${this.baseUrl}/api/appointments/${appointmentId}/reschedule`, {
      startTime,
      endTime
    });
  }

  removeAppointment(appointmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/appointments/${appointmentId}`);
  }

  updateServiceRequirement(
    serviceId: string,
    requirementId: string,
    request: DashboardUpdateServiceRequirementRequest
  ): Observable<DashboardServiceRequirement> {
    return this.http.put<DashboardServiceRequirement>(
      `${this.baseUrl}/api/services/${serviceId}/requirements/${requirementId}`,
      request
    );
  }

  removeServiceRequirement(serviceId: string, requirementId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/services/${serviceId}/requirements/${requirementId}`);
  }
}
