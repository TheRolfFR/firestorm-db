//* test here typings from "../typings/index.d.ts"
import { firestorm, Collection, Raw } from "../typings/index";

firestorm.address("http://localhost/firestorm/"); // php files location
firestorm.token("12345"); // identification token for php files

// declare User collection
interface User {
  name: string;
  age: number;
  alive: boolean;
  cars: string[];
  address: {
    street: string;
    city: string;
    country: string;
  },
  friend: User;
}

const users: Collection<User> = firestorm.collection<User>("users");
const idDad = await users.add({ name: "John", age: 30, alive: true, cars: ["BMW", "Citroen"], address: null, friend: null });
// const idsMom = await users.addBulk([{ name: "Anna", age: 35, alive: false, cars: [] }, { name: "Marge", age: 40, alive: true, cars: ["Audi", "Mazda"] }]);
// const idsChildren = await users.addBulk([{ name: "Jack", age: 5, alive: true, cars: [] }, { name: "Jill", age: 2, alive: true, cars: [] }, { name: "Joe", age: 7, alive: true, cars: [] }]);
// const idDad = null;
const idsMom = null;
const idsChildren = null;

interface Family {
  getChildren3: () => Promise<User[]>;
  getChildren2: () => Promise<User[]>;
  getDad: () => Promise<User>;
  getMom: () => Promise<User>;
  getChildren: () => Promise<User[]>;
  dad: string;
  mom: string;
  children: string[];
}

const families = firestorm.collection<Family>("families", (el) => {
  el.getChildren  = async (): Promise<User[]> => users.search([{ field: "id", criteria: "==", value: 0 }]);
  el.getChildren2 = async (): Promise<User[]> => users.search([{ field: "age", criteria: ">=", value: 5 }]);
  el.getChildren3 = async (): Promise<User[]> => users.search([{ field: "name", criteria: "in", value: ["Jack", "Jill", "Joe"] }]);

  return el;
});

users.editField({
  id: idDad,
  field: "name",
  operation: "remove"
})

users.editField({
  id: idDad,
  field: "cars",
  operation: "array-push",
  value: "yolo"
})


const ids: string[] = await families.addBulk([
  {
    dad: idDad,
    mom: idsMom[0],
    children: [idsChildren[0]],
  },
  {
    dad: idDad, // same dad duh
    mom: idsMom[1],
    children: [idsChildren[1], idsChildren[2]],
  }
]);

ids.forEach(async (id: string) => {
  const f: Family = await families.get(id);
  const dad: User = await (await families.get(id)).getDad();
})

const u: Raw<User> = await users.read_raw();
await users.write_raw(u);