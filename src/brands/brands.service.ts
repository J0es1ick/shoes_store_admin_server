import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from './entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private brandRepository: Repository<Brand>,
  ) {}

  async create(createBrandDto: CreateBrandDto) {
    const existingbrand = await this.brandRepository.findOne({
      where: { brand_name: createBrandDto.brand_name },
    });

    if (existingbrand) {
      throw new ConflictException('Brand with this name already exists');
    }

    const brand = this.brandRepository.create(createBrandDto);
    return this.brandRepository.save(brand);
  }

  async findAll(page: number = 1, limit: number = 8) {
    limit = Math.min(limit, 100);

    const [brands, total] = await this.brandRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { brand_name: 'DESC' },
    });

    return {
      data: brands,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const brand = await this.brandRepository.findOneBy({ brand_id: id });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async update(id: number, updateBrandDto: UpdateBrandDto) {
    const brand = await this.findOne(id);

    if (
      updateBrandDto.brand_name &&
      updateBrandDto.brand_name !== brand.brand_name
    ) {
      const existingBrand = await this.brandRepository.findOne({
        where: { brand_name: updateBrandDto.brand_name },
      });

      if (existingBrand) {
        throw new ConflictException('Brand with this name already exists');
      }
    }

    const toUpdate = {
      ...brand,
      ...updateBrandDto,
    };

    await this.brandRepository.update(id, toUpdate);
    return this.brandRepository.findOneBy({ brand_id: id });
  }

  async remove(id: number) {
    const result = await this.brandRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }
  }
}
