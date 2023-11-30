import ServiceModel from '../models/ServiceModel';
import IServiceModel from '../interfaces/IServiceModel';
import CreateService from '../interfaces/CreateService';
import ServiceResponse from '../utils/ServiceResponse';
import Service from '../interfaces/Service';
import PaymentHistoryModel from '../models/PaymentHistoryModel';
import ServiceItem from '../interfaces/ServiceItem';
import Payment from '../interfaces/Payment';
import CreateServiceItem from '../interfaces/CreateServiceItem';
import IServiceItemsModel from '../interfaces/IServiceItemsModel';
import ServiceItemsModel from '../models/ServiceItemsModel';
import { Decimal } from '@prisma/client/runtime/library';

type PayData = {
  service: Service, value: number, paymentTypeId: number, totalPaid: number, totalPrice: number,
};

export default class ServiceService {
  private model: IServiceModel;
  private paymentModel: PaymentHistoryModel;
  private itemsModel: IServiceItemsModel;

  constructor(
    m: IServiceModel = new ServiceModel(),
    p: PaymentHistoryModel = new PaymentHistoryModel(),
    i: IServiceItemsModel = new ServiceItemsModel(),
  ) {
    this.model = m;
    this.paymentModel = p;
    this.itemsModel = i;
  }

  private static calculateTotalPrice(items?: ServiceItem[]) {
    const totalPrice = items?.reduce((acc, { price }) => acc + parseFloat(price.toString()), 0);
    return totalPrice || 0;
  }

  private static calculatePaidValue(payments?: Payment[]) {
    const totalPaid = payments
      ?.reduce((acc, { paidValue }) => acc + parseFloat(paidValue.toString()), 0);
    return totalPaid || 0;
  }

  public async create(data: CreateService): Promise<ServiceResponse<Service>> {
    try {
      let service: Service;
      if (data.items && data.items.length > 0) {
        service = await this.model.createWithItems(data);
      } else {
        service = await this.model.create(data);
      }
      return new ServiceResponse<Service>('CREATED', service);
    } catch (error) {
      return new ServiceResponse<Service>('INTERNAL_ERROR', 'Internal server error');
    }
  }

  public async getAll(): Promise<ServiceResponse<Service[]>> {
    try {
      const services = await this.model.getAll();
      return new ServiceResponse<Service[]>('OK', services);
    } catch (error) {
      return new ServiceResponse<Service[]>('INTERNAL_ERROR', 'Internal server error');
    }
  }

  public async getById(id: number): Promise<ServiceResponse<Service>> {
    try {
      const service = await this.model.getById(id);
      if (service === null) {
        return new ServiceResponse<Service>('NOT_FOUND', 'Service not found');
      }
      const totalPrice = ServiceService.calculateTotalPrice(service.items);
      const totalPaid = ServiceService.calculatePaidValue(service.paymentsHistory);
      return new ServiceResponse<Service>('OK', { ...service, totalPrice, totalPaid });
    } catch (error) {
      return new ServiceResponse<Service>('INTERNAL_ERROR', 'Internal server error');
    }
  }

  private async payAndChangeStatus(
    { service, value, paymentTypeId, totalPaid, totalPrice }: PayData
  ): Promise<Service> {
    await this.paymentModel.create(service.id, paymentTypeId, value);

    if (totalPrice === totalPaid + value) {
      const updatedService = await this.model.updatePaymentStatus(service.id, 3);
      return { ...updatedService, totalPrice, totalPaid: totalPaid + value };
    }

    if (service.paymentStatus?.id === 1) {
      const updatedService = await this.model.updatePaymentStatus(service.id, 2);
      return { ...updatedService, totalPrice, totalPaid: totalPaid + value };
    }

    const updatedService = await this.model.getById(service.id) as Service;
    return  { ...updatedService, totalPrice, totalPaid: totalPaid + value };
  }

  public async pay(
    id: number, value: number, paymentTypeId: number
  ): Promise<ServiceResponse<Service>> {
    try {
      const service = await this.model.getById(id);

      if (!service) return new ServiceResponse<Service>('NOT_FOUND', 'Service not found.');

      const totalPrice = ServiceService.calculateTotalPrice(service.items)
      const totalPaid = ServiceService.calculatePaidValue(service.paymentsHistory);

      if (totalPaid === totalPrice)
        return new ServiceResponse<Service>('CONFLICT', 'Service has already been paid.');

      if (totalPaid + value > totalPrice)
        return new ServiceResponse<Service>('CONFLICT', 'Value invalid.');

      const updatedService = await this
        .payAndChangeStatus({ service, value, paymentTypeId ,totalPaid ,totalPrice })
      return new ServiceResponse<Service>('OK', updatedService);
    } catch (error) {
      return new ServiceResponse<Service>('INTERNAL_ERROR', 'Internal server error.');
    }
  }

  public async deleteService(id: number): Promise<ServiceResponse<null>> {
    try {
      /*const service = */await this.model.deleteService(id);
      return new ServiceResponse<null>('NO_CONTENT', null);
    } catch (error) {
      const { message } = error as Error;
      if (message.includes('to delete does not exist')) {
        return new ServiceResponse<null>('NOT_FOUND', 'Service not found.');
      }
      return new ServiceResponse<null>('INTERNAL_ERROR', 'Internal server error.');
    }
  }

  public async addItems(
    serviceId: number,
    items: CreateServiceItem[],
  ): Promise<ServiceResponse<Service>> {
    try {
      const service = await this.model.getById(serviceId);
      if (!service) return new ServiceResponse<Service>('NOT_FOUND', 'Service not found.');
      const itemsToAdd = items.map((item) => ({ serviceId, ...item }));
      const itemsConverted = items.map((item) => ({ ...item, price: new Decimal(item.price)}));
      await this.itemsModel.addItemInService(itemsToAdd);
      service.items = [...(service.items || []), ...itemsConverted];
      return new ServiceResponse<Service>('OK', service);
    } catch (error) {
      console.log(error);
      
      return new ServiceResponse<Service>('INTERNAL_ERROR', 'Internal server error.');
    }
  }
}
