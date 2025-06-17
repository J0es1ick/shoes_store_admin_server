import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Brand } from '../brands/entities/brand.entity';
import { Category } from '../categories/entities/category.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const brand = await this.brandRepository.findOneBy({
      brand_id: createProductDto.brand_id,
    });
    const category = await this.categoryRepository.findOneBy({
      category_id: createProductDto.category_id,
    });
    const supplier = await this.supplierRepository.findOneBy({
      supplier_id: createProductDto.supplier_id,
    });

    if (!brand || !category || !supplier) {
      throw new NotFoundException(
        'One of the related entities (Brand/Category/Supplier) not found',
      );
    }

    const product = this.productRepository.create({
      ...createProductDto,
      brand,
      category,
      supplier,
    });

    return this.productRepository.save(product);
  }

  async findAll(
    page: number = 1,
    limit: number = 8,
    categoryIds?: number[],
    brandIds?: number[],
  ) {
    const where = {};

    limit = Math.min(limit, 100);

    if (categoryIds?.length) {
      where['category'] = { category_id: In(categoryIds) };
    }

    if (brandIds?.length) {
      where['brand'] = { brand_id: In(brandIds) };
    }

    const [products, total] = await this.productRepository.findAndCount({
      where,
      relations: ['brand', 'category', 'supplier', 'sizes'],
      skip: (page - 1) * limit,
      take: limit,
      order: { product_id: 'DESC' },
    });

    return {
      data: products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const product = await this.productRepository.findOne({
      where: { product_id: id },
      relations: ['brand', 'category', 'supplier', 'sizes'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    if (Object.keys(updateProductDto).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const product = await this.findOne(id);

    if (updateProductDto.brand_id !== undefined) {
      const brand = await this.brandRepository.findOneBy({
        brand_id: updateProductDto.brand_id,
      });
      if (!brand) {
        throw new NotFoundException(
          `Brand with ID ${updateProductDto.brand_id} not found`,
        );
      }
      product.brand = brand;
    }

    if (updateProductDto.category_id !== undefined) {
      const category = await this.categoryRepository.findOneBy({
        category_id: updateProductDto.category_id,
      });
      if (!category) {
        throw new NotFoundException(
          `Category with ID ${updateProductDto.category_id} not found`,
        );
      }
      product.category = category;
    }

    if (updateProductDto.supplier_id !== undefined) {
      const supplier = await this.supplierRepository.findOneBy({
        supplier_id: updateProductDto.supplier_id,
      });
      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${updateProductDto.supplier_id} not found`,
        );
      }
      product.supplier = supplier;
    }

    this.productRepository.merge(product, updateProductDto);
    return this.productRepository.save(product);
  }

  async remove(id: number) {
    const result = await this.productRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }
}
