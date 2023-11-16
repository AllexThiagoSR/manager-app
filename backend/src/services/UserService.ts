import UserModel from '../models/UserModel';
import IUserModel from '../interfaces/IUserModel';
import Encrypter from '../utils/Encrypter';
import ServiceResponse from '../utils/ServiceResponse';
import TokenUtils from '../utils/TokenUtils';
import ICreateUser from '../interfaces/ICreateUser';
import IUserResponse from '../interfaces/IUserResponse';

type Token = { token: string };

export default class UserService {
  private model: IUserModel;
  private encrypter = new Encrypter();
  private tokenHandler = new TokenUtils();

  constructor (m: IUserModel = new UserModel()) {
    this.model = m;
  }

  public async login(email: string, password: string): Promise<ServiceResponse<Token>> {
    try {
      const user = await this.model.getByEmail(email);
      if (!user || !this.encrypter.compare(user.password, password)) {
        return new ServiceResponse<Token>('UNAUTHORIZED', 'Invalid email or password');
      }
      const token = this.tokenHandler.encode({
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });
      return new ServiceResponse<Token>('OK', { token });
    } catch (error) {
      return new ServiceResponse<Token>('INTERNAL_ERROR', 'An internal error has occurred');
    }
  }

  public async signUp (userData: ICreateUser): Promise<ServiceResponse<IUserResponse>> {
    try {
      const foundUser = await this.model.getByEmail(userData.email);
      if (foundUser) {
        return new ServiceResponse<IUserResponse>('CONFLICT', 'Email already exists');
      }
      userData.password = this.encrypter.encrypt(userData.password);
      const user = await this.model.create(userData);
      return new ServiceResponse<IUserResponse>('CREATED', user);
    } catch (error) {
      return new ServiceResponse<IUserResponse>('INTERNAL_ERROR', 'An internal error has occurred');
    }
  }
}