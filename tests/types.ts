// todo: test here typings from "../typings/index.d.ts"
import { firestorm, Collection, Raw } from "../typings/index";

firestorm.address("http://localhost/firestorm/"); // php files location
firestorm.token("12345"); // identification token for php files

// declare User collection
interface User {
  name: string;
  age: number;
}

const users: Collection<User> = firestorm.collection<User>("users");
const idDad = await users.add({ name: "John", age: 30 });
const idsMom = await users.addBulk([{ name: "Anna", age: 35 }, { name: "Marge", age: 40 }]);
const idsChildren = await users.addBulk([{ name: "Jack", age: 5 }, { name: "Jill", age: 2 }, { name: "Joe", age: 7 }]);

interface Family {
  getDad: () => Promise<User>;
  getMom: () => Promise<User>;
  getChildren: () => Promise<User[]>;
  dad: string;
  mom: string;
  children: string[];
}

const families = firestorm.collection<Family>("families", (el) => {
  el.getDad = async (): Promise<User> => users.get(el.dad);
  el.getMom = async (): Promise<User> => users.get(el.mom);
  el.getChildren = async (): Promise<User[]> => users.search([{ field: "id", criteria: "in", value: el.children }]);

  return el;
});

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

users.search([{
  field: "age",
  criteria: "==",
  value: "1"
}])