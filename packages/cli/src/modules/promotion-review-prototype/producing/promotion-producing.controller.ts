import { PromotionMarkForDeploymentRequestDto } from '@n8n/api-types';
import { AuthenticatedRequest } from '@n8n/db';
import { Body, Get, Param, Post, RestController } from '@n8n/decorators';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';

import { UnauthenticatedError } from '@/errors/response-errors/unauthenticated.error';
import { ApiKeyAuthStrategy } from '@/services/api-key-auth.strategy';

import { PromotionProducingService } from './promotion-producing.service';

const API_KEY_HEADER = 'x-n8n-api-key';

/**
 * Producing-side endpoints. `markForDeployment` is triggered locally on the
 * producing instance (normal session auth). The pull endpoints (`outbox`,
 * `deployables/:hash`) are called cross-instance by a consuming instance, so
 * they skip session auth and validate the scoped API key in the request header
 * instead — see ADR-0001 (target-initiated pull, outbound from production).
 */
@RestController('/promotion-review-prototype/producing')
export class PromotionProducingController {
	constructor(
		private readonly service: PromotionProducingService,
		private readonly apiKeyAuthStrategy: ApiKeyAuthStrategy,
	) {}
	@Get('/workflows')
	async listProducibleWorkflows() {
		return await this.service.listProducibleWorkflows();
	}

	@Post('/deployables')
	async markForDeployment(
		req: AuthenticatedRequest,
		_res: Response,
		@Body body: PromotionMarkForDeploymentRequestDto,
	) {
		return await this.service.markForDeployment(
			req.user,
			body.workflowIds,
			body.targetEnv,
			body.title,
		);
	}

	@Get('/outbox', { skipAuth: true })
	async listOutbox(req: Request) {
		await this.requireApiKey(req);
		return this.service.listOutbox();
	}

	@Get('/deployables/:hash', { skipAuth: true })
	async serveDeployable(
		req: Request,
		res: Response,
		@Param('hash') hash: string,
	): Promise<Readable> {
		await this.requireApiKey(req);
		const buffer = this.service.getDeployableBytes(hash);
		res.setHeader('Content-Type', 'application/gzip');
		res.setHeader('Content-Disposition', `attachment; filename="${hash}.n8np"`);
		return Readable.from(buffer);
	}

	/** Validates the consuming instance's scoped API key against this instance's keys. */
	private async requireApiKey(req: Request): Promise<void> {
		const header = req.headers[API_KEY_HEADER];
		const token = typeof header === 'string' ? header : undefined;
		const grant = token ? await this.apiKeyAuthStrategy.buildTokenGrant(token) : null;
		if (!grant) {
			throw new UnauthenticatedError('Valid API key required to pull promotions');
		}
	}
}
