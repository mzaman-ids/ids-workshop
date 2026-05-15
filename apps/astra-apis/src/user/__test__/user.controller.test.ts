import {ConflictException, InternalServerErrorException} from '@nestjs/common';
import {Test, TestingModule} from '@nestjs/testing';
import {vi} from 'vitest';
import {LocationService} from '../../location/location.service';
import type {RegisterUserDto, RegisterUserResponse} from '../dto/register-user.dto.js';
import {UserListQueryDto} from '../dto/user-list.query.dto';
import {UserController} from '../user.controller';
import {UserService} from '../user.service';

type UserServiceMock = {
  registerUser: ReturnType<typeof vi.fn>;
  findAll: ReturnType<typeof vi.fn>;
  deleteUserProfile: ReturnType<typeof vi.fn>;
  restoreUserProfile: ReturnType<typeof vi.fn>;
};

const createMockRegisterResponse = (
  overrides: Partial<RegisterUserResponse> = {},
): RegisterUserResponse => ({
  userId: 'logto-user-id-123',
  email: 'test@example.com',
  message: 'User registered successfully',
  ...overrides,
});

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const userServiceMock: UserServiceMock = {
    registerUser: vi.fn(),
    findAll: vi.fn(),
    deleteUserProfile: vi.fn(),
    restoreUserProfile: vi.fn(),
  };

  const mockLocationService: {getUserLocations: ReturnType<typeof vi.fn>} = {
    getUserLocations: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: userServiceMock,
        },
        {
          provide: LocationService,
          useValue: mockLocationService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    const validRegisterDto: RegisterUserDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
    };

    const expectedResponse: RegisterUserResponse = createMockRegisterResponse();

    it('should successfully register a new user', async () => {
      userServiceMock.registerUser.mockResolvedValue(expectedResponse);

      const result: RegisterUserResponse = await controller.register(validRegisterDto);

      expect(result).toEqual(expectedResponse);
      expect(userService.registerUser).toHaveBeenCalledWith(validRegisterDto);
      expect(userService.registerUser).toHaveBeenCalledTimes(1);
    });

    it('should register a user without optional username', async () => {
      const dtoWithoutUsername: RegisterUserDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const response: RegisterUserResponse = createMockRegisterResponse({
        userId: 'logto-user-id-456',
      });

      userServiceMock.registerUser.mockResolvedValue(response);

      const result: RegisterUserResponse = await controller.register(dtoWithoutUsername);

      expect(result).toEqual(response);
      expect(userService.registerUser).toHaveBeenCalledWith(dtoWithoutUsername);
    });

    it('should throw ConflictException when email already exists', async () => {
      userServiceMock.registerUser.mockRejectedValue(
        new ConflictException('A user with this email already exists'),
      );

      await expect(controller.register(validRegisterDto)).rejects.toThrow(ConflictException);
      await expect(controller.register(validRegisterDto)).rejects.toThrow(
        'A user with this email already exists',
      );
    });

    it('should throw InternalServerErrorException on service failure', async () => {
      userServiceMock.registerUser.mockRejectedValue(
        new InternalServerErrorException('Failed to register user. Please try again later.'),
      );

      await expect(controller.register(validRegisterDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle registration with optional phone number', async () => {
      const dtoWithPhone: RegisterUserDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        phoneNumber: '+1234567890',
      };

      userServiceMock.registerUser.mockResolvedValue(expectedResponse);

      const result: RegisterUserResponse = await controller.register(dtoWithPhone);

      expect(result).toEqual(expectedResponse);
      expect(userService.registerUser).toHaveBeenCalledWith(dtoWithPhone);
    });
  });

  describe('findAll', () => {
    it('should return paginated users when no filters given', async () => {
      const pagedResult = {
        items: [],
        page: 1,
        pageSize: 10,
        totalCount: 0,
        totalPages: 0,
      };
      userServiceMock.findAll.mockResolvedValue(pagedResult);

      const result = await controller.findAll({} as UserListQueryDto);

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(userServiceMock.findAll).toHaveBeenCalledWith({
        searchTerm: undefined,
        isDeleted: undefined,
        page: undefined,
        pageSize: undefined,
      });
    });

    it('should parse isDeleted string "false" as boolean false', async () => {
      userServiceMock.findAll.mockResolvedValue({items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0});

      await controller.findAll({isDeleted: 'false'} as unknown as UserListQueryDto);

      expect(userServiceMock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({isDeleted: false}),
      );
    });
  });

  describe('deactivate', () => {
    it('should call deleteUserProfile and return UserResponseDto', async () => {
      const mockUser = {
        id: 'users/u1',
        logtoUserId: 'u1',
        email: 'a@a.com',
        username: null,
        nickname: null,
        displayName: 'Alice',
        bio: null,
        preferredLanguage: null,
        timezone: null,
        emailNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
        profileCompleteness: 50,
        lastLoginAt: null,
        hasProfilePhoto: false,
        isDeleted: true,
        createdDate: new Date(),
        updatedDate: new Date(),
        version: 1,
      };
      userServiceMock.deleteUserProfile.mockResolvedValue(mockUser);

      const result = await controller.deactivate('u1');

      expect(result.logtoUserId).toBe('u1');
      expect(result.isDeleted).toBe(true);
      expect(userServiceMock.deleteUserProfile).toHaveBeenCalledWith('u1');
    });
  });

  describe('restore', () => {
    it('should call restoreUserProfile and return UserResponseDto', async () => {
      const mockUser = {
        id: 'users/u1',
        logtoUserId: 'u1',
        email: 'a@a.com',
        username: null,
        nickname: null,
        displayName: 'Alice',
        bio: null,
        preferredLanguage: null,
        timezone: null,
        emailNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
        profileCompleteness: 50,
        lastLoginAt: null,
        hasProfilePhoto: false,
        isDeleted: false,
        createdDate: new Date(),
        updatedDate: new Date(),
        version: 1,
      };
      userServiceMock.restoreUserProfile.mockResolvedValue(mockUser);

      const result = await controller.restore('u1');

      expect(result.logtoUserId).toBe('u1');
      expect(result.isDeleted).toBe(false);
      expect(userServiceMock.restoreUserProfile).toHaveBeenCalledWith('u1');
    });
  });
});
