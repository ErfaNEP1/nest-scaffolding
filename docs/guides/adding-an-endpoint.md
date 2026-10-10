# Adding an endpoint

Conventions: `docs/api/conventions.md`. Checklist: `.agents/skills/api-endpoint/SKILL.md`.

```ts
// <module>.dto.ts
export const orderResponseSchema = z.object({
  id: z.uuid(),
  total: z.number().int(),
  currency: z.string().length(3),
});
export class OrderResponse extends createZodDto(orderResponseSchema) {}
export class CreateOrderRequest extends createZodDto(
  z.object({ items: z.array(itemSchema).min(1) }),
) {}

// <module>.controller.ts
@Roles('user')
@Controller({ path: 'orders', version: '1' })
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post()
  @HttpCode(201)
  @ApiProblems(400, 401, 403, 409)
  @ZodResponse({ status: 201, description: 'Order created.', type: OrderResponse })
  async create(@CurrentUser() user: Principal, @Body() body: CreateOrderRequest) {
    return toOrderResponse(await this.orders.create(user, body));
  }
}
```

1. Zod schemas and DTOs for body, query, params and response.
2. Controller method: `@ZodResponse`, `@ApiProblems`, `@Roles` if needed. No logic.
3. Service: business rules, authorization for the resource, domain errors.
4. `pnpm openapi:generate` and commit `openapi/openapi.json`. Breaking change → bump the
   major version in `contract/package.json` and add a **BREAKING:** CHANGELOG entry.
5. E2E test: main path, 400, 401, 403, 404, 409 where they apply.
6. Module README endpoint table, CHANGELOG.
