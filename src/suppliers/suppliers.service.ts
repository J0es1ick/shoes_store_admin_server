import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './entities/supplier.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  async create(createSupplierDto: CreateSupplierDto) {
    const existingSupplier = await this.supplierRepository.findOne({
      where: [
        { email: createSupplierDto.email },
        { phone: createSupplierDto.phone },
      ],
    });

    if (existingSupplier) {
      throw new ConflictException(
        'Supplier with this email or phone already exists',
      );
    }

    const supplier = this.supplierRepository.create(createSupplierDto);
    return this.supplierRepository.save(supplier);
  }

  async findAll(page: number = 1, limit: number = 8) {
    limit = Math.min(limit, 100);

    const [suppliers, total] = await this.supplierRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { supplier_id: 'DESC' },
      relations: ['products'],
    });

    return {
      data: suppliers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const supplier = await this.supplierRepository.findOne({
      where: { supplier_id: id },
      relations: ['products'],
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async update(id: number, updateSupplierDto: UpdateSupplierDto) {
    if (Object.keys(updateSupplierDto).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const supplier = await this.findOne(id);

    if (
      (updateSupplierDto.email && updateSupplierDto.email !== supplier.email) ||
      (updateSupplierDto.phone && updateSupplierDto.phone !== supplier.phone)
    ) {
      const existingSupplier = await this.supplierRepository.findOne({
        where: [
          { email: updateSupplierDto.email },
          { phone: updateSupplierDto.phone },
        ],
      });

      if (
        existingSupplier &&
        existingSupplier.supplier_id !== supplier.supplier_id
      ) {
        throw new ConflictException(
          'Supplier with this email or phone already exists',
        );
      }
    }

    const updatedSupplier = this.supplierRepository.merge(
      supplier,
      updateSupplierDto,
    );
    return this.supplierRepository.save(updatedSupplier);
  }

  async remove(id: number) {
    const supplier = await this.findOne(id);
    return this.supplierRepository.softRemove(supplier);
  }
}
