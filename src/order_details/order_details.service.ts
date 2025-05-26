import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDetailDto } from './dto/create-order_detail.dto';
import { UpdateOrderDetailDto } from './dto/update-order_detail.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { Size } from '../sizes/entities/size.entity';
import { Repository } from 'typeorm';
import { OrderDetails } from './entities/order_detail.entity';
import { OrdersService } from 'src/orders/orders.service';

@Injectable()
export class OrderDetailsService {
  constructor(
    @InjectRepository(OrderDetails)
    private readonly orderDetailsRepository: Repository<OrderDetails>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Size)
    private readonly sizeRepository: Repository<Size>,
    private readonly ordersService: OrdersService,
  ) {}

  async create(createOrderDetailsDto: CreateOrderDetailDto) {
    const order = await this.orderRepository.findOneBy({
      order_id: createOrderDetailsDto.order_id,
    });
    if (!order) throw new NotFoundException('Order not found');

    const size = await this.sizeRepository.findOne({
      where: {
        size: createOrderDetailsDto.size,
        product_id: createOrderDetailsDto.product_id,
      },
      relations: ['product'],
    });
    if (!size) throw new NotFoundException('Size for product not found');

    const existing = await this.orderDetailsRepository.findOne({
      where: {
        order_id: createOrderDetailsDto.order_id,
        product_id: createOrderDetailsDto.product_id,
        size: createOrderDetailsDto.size,
      },
    });
    if (existing) {
      throw new ConflictException(
        'Order detail for this product size already exists',
      );
    }

    const orderDetails = this.orderDetailsRepository.create({
      order_id: createOrderDetailsDto.order_id,
      product_id: createOrderDetailsDto.product_id,
      size: createOrderDetailsDto.size,
      quantity: createOrderDetailsDto.quantity,
      price_at_order: createOrderDetailsDto.price_at_order,
      order,
      sizeEntity: size,
    });

    const savedDetails = await this.orderDetailsRepository.save(orderDetails);

    await this.ordersService.updateOrderTotal(createOrderDetailsDto.order_id);

    return savedDetails;
  }

  async findAll(page: number = 1, limit: number = 8) {
    limit = Math.min(limit, 100);

    const [sizes, total] = await this.sizeRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: sizes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(orderId: number, productId: number, size: string) {
    const orderDetail = await this.orderDetailsRepository.findOne({
      where: {
        order_id: orderId,
        product_id: productId,
        size,
      },
      relations: ['order', 'sizeEntity', 'sizeEntity.product'],
    });

    if (!orderDetail) {
      throw new NotFoundException(
        `Order detail not found for order ${orderId}, product ${productId}, size ${size}`,
      );
    }

    return orderDetail;
  }

  async update(
    orderId: number,
    productId: number,
    size: string,
    updateDto: UpdateOrderDetailDto,
  ) {
    if (Object.keys(updateDto).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const orderDetail = await this.findOne(orderId, productId, size);

    if (updateDto.quantity !== undefined) {
      orderDetail.quantity = updateDto.quantity;
    }

    if (updateDto.price_at_order !== undefined) {
      orderDetail.price_at_order = updateDto.price_at_order;
    }

    const updatedDetail = await this.orderDetailsRepository.save(orderDetail);

    await this.ordersService.updateOrderTotal(orderId);

    return updatedDetail;
  }

  async remove(orderId: number, productId: number, size: string) {
    const result = await this.orderDetailsRepository.delete({
      order_id: orderId,
      product_id: productId,
      size,
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Order detail not found for order ${orderId}, product ${productId}, size ${size}`,
      );
    }
  }
}
