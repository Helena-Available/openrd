/**
 * 认证中间件
 * 验证JWT令牌并附加用户信息到请求对象
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/app-error.js';

/** 认证用户接口 */
export interface AuthenticatedUser {
  id: string;
  phoneNumber: string;
  email: string | null;
  role: string;
  createdAt: string;
}

/** 扩展的Request接口 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * JWT认证中间件
 * 从Authorization头中提取并验证JWT令牌
 */
export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError('未提供认证令牌', 401);
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError('认证令牌格式无效', 401);
    }

    // 验证JWT令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      role: string;
      iat: number;
      exp: number;
    };

    // 附加用户信息到请求对象
    // 注意：这里假设用户信息已存在于数据库中
    // 实际项目中可能需要从数据库查询完整用户信息
    req.user = {
      id: decoded.sub,
      phoneNumber: '', // 将在需要时从数据库填充
      email: null,
      role: decoded.role,
      createdAt: new Date().toISOString(), // 占位符
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('认证令牌无效', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('认证令牌已过期', 401));
    } else {
      next(error);
    }
  }
};

/**
 * 可选认证中间件
 * 如果提供令牌则验证，否则继续执行
 */
export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  authenticate(req, res, next);
};

/**
 * 角色授权中间件
 * @param allowedRoles 允许的角色数组
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('需要认证', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('权限不足', 403));
    }

    next();
  };
};