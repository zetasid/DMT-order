import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import authRouter from "./auth";
import healthRouter from "./health";
import tenantsRouter from "./tenants";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tenantsRouter);
router.use(adminRouter);

export default router;
