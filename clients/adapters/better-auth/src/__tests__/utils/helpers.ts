import { vi } from "vitest";
import type { PolarOptions } from "../../types";
import { createMockPolarClient } from "./mocks";

export const createTestPolarOptions = (
	overrides: Partial<PolarOptions> = {},
): PolarOptions => ({
	client: createMockPolarClient(),
	createCustomerOnSignUp: true,
	use: [],
	...overrides,
});

export { createMockPolarClient };

export const mockApiError = (status: number, message: string) => {
	const error = new Error(message) as any;
	error.status = status;
	error.response = {
		status,
		data: { error: { message } },
	};
	return error;
};

export const mockApiResponse = <T>(data: T) => Promise.resolve({ data });

export const createMockMiddleware = () => {
	const middleware = vi.fn();
	middleware.mockImplementation((context, next) => next());
	return middleware;
};
