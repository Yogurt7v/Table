/** Цель удаления организации: id и имя. */
export interface AdminOrgTarget {
  id: string;
  name: string;
}

/** Цель удаления пользователя: id и имя. */
export interface AdminUserTarget {
  id: string;
  name: string;
}

/** Данные формы создания организации. */
export interface AdminCreateOrgData {
  name: string;
  color: string;
  accountNames: string[];
}
