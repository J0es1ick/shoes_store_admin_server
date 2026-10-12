import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AccountService } from '../../application/services/account.service';
import { AdminService } from '../../application/services/admin.service';
import { AuthService } from '../../application/services/auth.service';
import { CatalogService } from '../../application/services/catalog.service';
import { OrdersService } from '../../application/services/orders.service';
import { publicUser } from '../../domain/models';
import { Access, readToken, StoreRequest } from './auth.guard';
import {
  CheckoutDto,
  FavoriteDto,
  LoginDto,
  ProductDto,
  ProfileDto,
  RegisterDto,
  StatusDto,
} from './dto';

@Controller('store')
export class ShopController {
  constructor(
    private readonly auth: AuthService,
    private readonly catalogService: CatalogService,
    private readonly account: AccountService,
    private readonly ordersService: OrdersService,
    private readonly adminService: AdminService,
  ) {}
  private cookie(response: Response, token: string, clear = false) {
    response.cookie('step_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        process.env.STORE_COOKIE_SECURE === 'true' ||
        (process.env.NODE_ENV === 'production' &&
          process.env.STORE_COOKIE_SECURE !== 'false'),
      path: '/api',
      maxAge: clear ? 0 : 7 * 86400_000,
    });
  }
  @Get('health') @Access('public') health() {
    return { status: 'ok', demo: process.env.STORE_STORAGE === 'file' };
  }
  @Get('products') @Access('public') products() {
    return this.catalogService.catalog();
  }
  @Get('products/:id') @Access('public') product(@Param('id') id: string) {
    return this.catalogService.product(id);
  }
  @Post('auth/register') @Access('public') async register(
    @Body() body: RegisterDto,
    @Req() req: StoreRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.auth.throttle(req.ip || 'unknown');
    const result = await this.auth.register(body);
    this.cookie(res, result.token);
    return result.user;
  }
  @Post('auth/login') @Access('public') async login(
    @Body() body: LoginDto,
    @Req() req: StoreRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.auth.throttle(req.ip || 'unknown');
    const result = await this.auth.login(body.email, body.password);
    this.cookie(res, result.token);
    return result.user;
  }
  @Post('auth/logout') @Access('public') async logout(
    @Req() req: StoreRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readToken(req);
    if (token) await this.auth.logout(token);
    this.cookie(res, '', true);
    return { ok: true };
  }
  @Get('auth/me') @Access('public') async me(
    @Req() req: StoreRequest,
    @Res() res: Response,
  ) {
    const user = await this.auth.session(readToken(req));
    return res.json(user ? publicUser(user) : null);
  }
  @Patch('profile') @Access('customer') profile(
    @Req() req: StoreRequest,
    @Body() body: ProfileDto,
  ) {
    return this.account.updateProfile(req.storeUser.id, body);
  }
  @Patch('favorites/:id') @Access('customer') favorite(
    @Req() req: StoreRequest,
    @Param('id') id: string,
    @Body() body: FavoriteDto,
  ) {
    return this.account.favorite(req.storeUser.id, id, body.saved);
  }
  @Get('orders') @Access('customer') orders(@Req() req: StoreRequest) {
    return this.ordersService.orders(req.storeUser.id);
  }
  @Post('orders') @Access('customer') checkout(
    @Req() req: StoreRequest,
    @Body() body: CheckoutDto,
  ) {
    return this.ordersService.checkout(req.storeUser.id, body);
  }
  @Post('orders/:id/cancel') @Access('customer') cancel(
    @Req() req: StoreRequest,
    @Param('id') id: string,
  ) {
    return this.ordersService.cancelOrder(req.storeUser.id, id);
  }
  @Get('admin') @Access('admin') admin() {
    return this.adminService.adminData();
  }
  @Post('admin/products') @Access('admin') createProduct(
    @Body() body: ProductDto,
  ) {
    return this.adminService.saveProduct(body);
  }
  @Patch('admin/products/:id') @Access('admin') updateProduct(
    @Param('id') id: string,
    @Body() body: ProductDto,
  ) {
    return this.adminService.saveProduct(body, id);
  }
  @Delete('admin/products/:id') @Access('admin') archive(
    @Param('id') id: string,
  ) {
    return this.adminService.archiveProduct(id);
  }
  @Patch('admin/orders/:id') @Access('admin') status(
    @Param('id') id: string,
    @Body() body: StatusDto,
  ) {
    return this.adminService.orderStatus(id, body.status);
  }
}
