interface IUser {
  id: number;
  fullName: string;
  email: string;
  password: string;
  isAdmin: boolean;
  employeeId?: number | null;
  employee?: unknown | null;
}

export default IUser;