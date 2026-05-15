import * as v from 'valibot';

export const createUserSchema = v.object({
  firstName: v.pipe(v.string(), v.minLength(1, 'First name is required')),
  lastName: v.pipe(v.string(), v.minLength(1, 'Last name is required')),
  email: v.pipe(v.string(), v.email('Invalid email address')),
  password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
  username: v.optional(v.string()),
});

export type CreateUserFormValues = v.InferOutput<typeof createUserSchema>;
