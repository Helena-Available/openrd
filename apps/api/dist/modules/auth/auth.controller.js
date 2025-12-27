import { loginSchema, registerSchema } from './auth.schema.js';
export class AuthController {
    service;
    constructor(service) {
        this.service = service;
    }
    register = async (req, res) => {
        const payload = registerSchema.parse(req.body);
        const result = await this.service.register(payload);
        res.status(201).json(result);
    };
    login = async (req, res) => {
        const payload = loginSchema.parse(req.body);
        const result = await this.service.login(payload);
        res.status(200).json(result);
    };
}
//# sourceMappingURL=auth.controller.js.map