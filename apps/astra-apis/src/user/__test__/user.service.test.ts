import {BadRequestException, ConflictException, Logger, NotFoundException} from '@nestjs/common';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {RavenSessionFactory} from '../../infrastructure/ravendb/session-factory';
import {RavenDocumentStoreProvider} from '../../infrastructure/ravendb/document-store.provider';
import type {RegisterUserDto, RegisterUserResponse} from '../dto/register-user.dto.js';
import {LogtoManagementClient} from '../logto-management.client';
import {UserService} from '../user.service';

type LogtoCreateUserResponse = Awaited<ReturnType<LogtoManagementClient['createUser']>>;

// Suppress error logs during tests
vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

function createMockQueryBuilder(items: unknown[] = [], totalResults?: number) {
  const total = totalResults ?? items.length;
  const builder = {
    whereEquals: vi.fn().mockReturnThis(),
    search: vi.fn().mockReturnThis(),
    statistics: vi.fn().mockImplementation((cb: (s: {totalResults: number}) => void) => {
      cb({totalResults: total});
      return builder;
    }),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(items),
  };
  return builder;
}

function createMockSession(queryItems: unknown[] = [], queryTotal?: number) {
  const session = {
    load: vi.fn(),
    store: vi.fn(),
    saveChanges: vi.fn(),
    dispose: vi.fn(),
    query: vi.fn().mockReturnValue(createMockQueryBuilder(queryItems, queryTotal)),
    advanced: {
      attachments: {
        exists: vi.fn().mockResolvedValue(false),
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
      },
    },
    [Symbol.dispose]() {
      (this as {dispose: () => void}).dispose();
    },
  };
  return session;
}

const mockStoreProvider = {
  getStore: vi.fn().mockReturnValue({}),
} as unknown as RavenDocumentStoreProvider;

function createMockSessionFactory(session: ReturnType<typeof createMockSession>) {
  return {openSession: vi.fn().mockReturnValue(session)} as unknown as RavenSessionFactory;
}

const mockLogtoCreateUserResponse = (
  overrides: Partial<LogtoCreateUserResponse> = {},
): LogtoCreateUserResponse => ({
  id: 'logto-user-id-123',
  username: 'johndoe',
  primaryEmail: 'test@example.com',
  primaryPhone: null,
  name: 'John Doe',
  avatar: null,
  createdAt: Date.now(),
  lastSignInAt: null,
  ...overrides,
});

describe('UserService', () => {
  let service: UserService;
  let session: ReturnType<typeof createMockSession>;
  let logtoClientMock: {
    createUser: ReturnType<typeof vi.fn>;
    getUser?: ReturnType<typeof vi.fn>;
    suspendUser: ReturnType<typeof vi.fn>;
    unsuspendUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    session = createMockSession();
    logtoClientMock = {
      createUser: vi.fn(),
      getUser: vi.fn(),
      suspendUser: vi.fn().mockResolvedValue(undefined),
      unsuspendUser: vi.fn().mockResolvedValue(undefined),
    };
    service = new UserService(
      logtoClientMock as unknown as LogtoManagementClient,
      createMockSessionFactory(session),
      mockStoreProvider,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerUser', () => {
    const validRegisterDto: RegisterUserDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
    };

    beforeEach(() => {
      session.load.mockResolvedValue(null); // No existing profile
      session.saveChanges.mockResolvedValue(undefined);
    });

    it('should successfully register a new user', async () => {
      logtoClientMock.createUser.mockResolvedValue(mockLogtoCreateUserResponse());

      const result: RegisterUserResponse = await service.registerUser(validRegisterDto);

      expect(result).toEqual({
        userId: 'logto-user-id-123',
        email: 'test@example.com',
        message: 'User registered successfully',
      });
      expect(logtoClientMock.createUser).toHaveBeenCalledWith({
        primaryEmail: 'test@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
        username: 'johndoe',
      });
      expect(session.store).toHaveBeenCalled();
      expect(session.saveChanges).toHaveBeenCalled();
    });

    it('should register user without optional username', async () => {
      const dtoWithoutUsername: RegisterUserDto = {
        email: 'jane@example.com',
        password: 'AnotherPass456!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      logtoClientMock.createUser.mockResolvedValue(
        mockLogtoCreateUserResponse({
          id: 'logto-user-id-456',
          username: null,
          primaryEmail: 'jane@example.com',
          name: 'Jane Smith',
        }),
      );

      const result: RegisterUserResponse = await service.registerUser(dtoWithoutUsername);

      expect(result.userId).toBe('logto-user-id-456');
      expect(logtoClientMock.createUser).toHaveBeenCalledWith(
        expect.objectContaining({username: undefined}),
      );
    });

    it('should throw BadRequestException when email is missing', async () => {
      const invalidDto: RegisterUserDto = {
        email: '',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      await expect(service.registerUser(invalidDto)).rejects.toThrow(BadRequestException);
      await expect(service.registerUser(invalidDto)).rejects.toThrow(
        'Email and password are required',
      );
      expect(logtoClientMock.createUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when password is missing', async () => {
      const invalidDto: RegisterUserDto = {
        email: 'test@example.com',
        password: '',
        firstName: 'John',
        lastName: 'Doe',
      };

      await expect(service.registerUser(invalidDto)).rejects.toThrow(BadRequestException);
      expect(logtoClientMock.createUser).not.toHaveBeenCalled();
    });

    it('should bubble raw error when email already exists in Logto', async () => {
      logtoClientMock.createUser.mockRejectedValue(new Error('User with email already exists'));

      await expect(service.registerUser(validRegisterDto)).rejects.toThrow(
        'User with email already exists',
      );
    });

    it('should rethrow ConflictException from Logto client', async () => {
      logtoClientMock.createUser.mockRejectedValue(new ConflictException('Username already taken'));

      await expect(service.registerUser(validRegisterDto)).rejects.toThrow(ConflictException);
    });

    it('should correctly format full name from firstName and lastName', async () => {
      const dto: RegisterUserDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Mary',
        lastName: 'Johnson',
      };
      logtoClientMock.createUser.mockResolvedValue(
        mockLogtoCreateUserResponse({name: 'Mary Johnson'}),
      );

      await service.registerUser(dto);

      expect(logtoClientMock.createUser).toHaveBeenCalledWith(
        expect.objectContaining({name: 'Mary Johnson'}),
      );
    });

    it('should throw NotFoundException when user profile not found for update', async () => {
      session.load.mockResolvedValue(null);

      await expect(service.updateUserProfile('nonexistent', {displayName: 'Test'})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users from the index', async () => {
      const mockUsers = [
        {id: 'users/u1', logtoUserId: 'u1', email: 'a@a.com', isDeleted: false},
        {id: 'users/u2', logtoUserId: 'u2', email: 'b@b.com', isDeleted: false},
      ];
      session = createMockSession(mockUsers, 2);
      service = new UserService(
        logtoClientMock as unknown as LogtoManagementClient,
        createMockSessionFactory(session),
        mockStoreProvider,
      );

      const result = await service.findAll({page: 1, pageSize: 10});

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(session.query).toHaveBeenCalledWith({indexName: 'Users/Search'});
    });

    it('should apply isDeleted filter when provided', async () => {
      session = createMockSession([], 0);
      service = new UserService(
        logtoClientMock as unknown as LogtoManagementClient,
        createMockSessionFactory(session),
        mockStoreProvider,
      );

      await service.findAll({isDeleted: false, page: 1, pageSize: 10});

      const queryBuilder = session.query.mock.results[0].value;
      expect(queryBuilder.whereEquals).toHaveBeenCalledWith('isDeleted', false);
    });

    it('should apply search term when provided', async () => {
      session = createMockSession([], 0);
      service = new UserService(
        logtoClientMock as unknown as LogtoManagementClient,
        createMockSessionFactory(session),
        mockStoreProvider,
      );

      await service.findAll({searchTerm: 'alice', page: 1, pageSize: 10});

      const queryBuilder = session.query.mock.results[0].value;
      expect(queryBuilder.search).toHaveBeenCalledWith('query', 'alice*', 'AND');
    });

    it('should not apply search for terms shorter than 2 characters', async () => {
      session = createMockSession([], 0);
      service = new UserService(
        logtoClientMock as unknown as LogtoManagementClient,
        createMockSessionFactory(session),
        mockStoreProvider,
      );

      await service.findAll({searchTerm: 'a', page: 1, pageSize: 10});

      const queryBuilder = session.query.mock.results[0].value;
      expect(queryBuilder.search).not.toHaveBeenCalled();
    });
  });

  describe('deleteUserProfile', () => {
    it('should soft-delete user and call logto suspend', async () => {
      const mockUser = {
        id: 'users/u1',
        logtoUserId: 'u1',
        email: 'a@a.com',
        isDeleted: false,
        createdDate: new Date(),
        updatedDate: new Date(),
        version: 1,
      };
      session.load.mockResolvedValue(mockUser);
      session.saveChanges.mockResolvedValue(undefined);
      logtoClientMock.suspendUser = vi.fn().mockResolvedValue(undefined);

      const result = await service.deleteUserProfile('u1');

      expect(result.isDeleted).toBe(true);
      expect(session.store).toHaveBeenCalled();
      expect(session.saveChanges).toHaveBeenCalled();
      expect(logtoClientMock.suspendUser).toHaveBeenCalledWith('u1');
    });

    it('should commit RavenDB soft-delete even when Logto suspend fails', async () => {
      const mockUser = {
        id: 'users/u1',
        logtoUserId: 'u1',
        email: 'a@a.com',
        isDeleted: false,
        createdDate: new Date(),
        updatedDate: new Date(),
        version: 1,
      };
      session.load.mockResolvedValue(mockUser);
      session.saveChanges.mockResolvedValue(undefined);
      logtoClientMock.suspendUser = vi.fn().mockRejectedValue(new Error('Logto down'));

      const result = await service.deleteUserProfile('u1');

      expect(result.isDeleted).toBe(true);
      expect(session.saveChanges).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      session.load.mockResolvedValue(null);

      await expect(service.deleteUserProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreUserProfile', () => {
    it('should un-soft-delete user and call logto unsuspend', async () => {
      const mockUser = {
        id: 'users/u1',
        logtoUserId: 'u1',
        email: 'a@a.com',
        isDeleted: true,
        createdDate: new Date(),
        updatedDate: new Date(),
        version: 1,
      };
      session.load.mockResolvedValue(mockUser);
      session.saveChanges.mockResolvedValue(undefined);
      logtoClientMock.unsuspendUser = vi.fn().mockResolvedValue(undefined);

      const result = await service.restoreUserProfile('u1');

      expect(result.isDeleted).toBe(false);
      expect(logtoClientMock.unsuspendUser).toHaveBeenCalledWith('u1');
    });

    it('should commit RavenDB restore even when Logto unsuspend fails', async () => {
      const mockUser = {
        id: 'users/u1',
        logtoUserId: 'u1',
        email: 'a@a.com',
        isDeleted: true,
        createdDate: new Date(),
        updatedDate: new Date(),
        version: 1,
      };
      session.load.mockResolvedValue(mockUser);
      session.saveChanges.mockResolvedValue(undefined);
      logtoClientMock.unsuspendUser = vi.fn().mockRejectedValue(new Error('Logto down'));

      const result = await service.restoreUserProfile('u1');

      expect(result.isDeleted).toBe(false);
    });
  });
});
