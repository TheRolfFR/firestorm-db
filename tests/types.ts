// todo: test here typings from "../typings/index.d.ts"
import { firestorm, Collection } from "../typings/index";

firestorm.address("http://localhost/firestorm/"); // php files location
firestorm.token("12345"); // identification token for php files

interface User {
  name: string;
  age: number;
}

const users: Collection<User> = firestorm.collection<User>("users");
const id = await users.add({ name: "John", age: 30 });

interface Family {
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
    dad: "id",
    mom: "id",
    children: ["id"],
  },
  {
    dad: "id",
    mom: "id",
    children: ["id", "id"],
  }
]);