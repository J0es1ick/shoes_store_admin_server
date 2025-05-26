import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderDetails } from 'src/order_details/entities/order_detail.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OrderDetails)
    private readonly orderDetailsRepository: Repository<OrderDetails>,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const user = await this.userRepository.findOneBy({
      user_id: createOrderDto.user_id,
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${createOrderDto.user_id} not found`,
      );
    }

    const order = this.orderRepository.create({
      total_amount: createOrderDto.total_amount,
      user,
    });

    try {
      return await this.orderRepository.save(order);
    } catch (error) {
      throw new ConflictException(error.message || 'Failed to create order');
    }
  }

  async updateOrderTotal(orderId: number) {
    const orderDetails = await this.orderDetailsRepository.find({
      where: { order_id: orderId },
    });

    const total = orderDetails.reduce((sum, item) => {
      return sum + item.price_at_order * item.quantity;
    }, 0);

    await this.orderRepository.update(orderId, { total_amount: total });
  }

  async findAll(page: number = 1, limit: number = 8) {
    limit = Math.min(limit, 100);

    const [orders, total] = await this.orderRepository.findAndCount({
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { order_id: 'DESC' },
    });

    return {
      data: orders,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const order = await this.orderRepository.findOne({
      where: { order_id: id },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async update(id: number, updateOrderDto: UpdateOrderDto) {
    const order = await this.findOne(id);

    if (updateOrderDto.user_id) {
      const user = await this.userRepository.findOneBy({
        user_id: updateOrderDto.user_id,
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${updateOrderDto.user_id} not found`,
        );
      }
      order.user = user;
    }

    if (updateOrderDto.total_amount !== undefined) {
      order.total_amount = updateOrderDto.total_amount;
    }

    this.orderRepository.merge(order, updateOrderDto);
    return await this.orderRepository.save(order);
  }

  async remove(id: number) {
    const result = await this.orderRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
  }
}
