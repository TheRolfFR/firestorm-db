// Stress test for firestorm-db TypeScript types.
import firestorm from "..";

/**
 * I. CREATE A COLLECTION
 */

// let's declare an interface for our collection
interface User {
	[firestorm.ID_FIELD]: string;
	name: string;
}

// then we add that interface in our constructor
firestorm.collection<User>("users");

// we can also declare a collection with methods listed in the interface
interface UserWithMethods extends User {
	getNameAsLowerCase: () => string;
}

// where the method implementation goes in the addMethods
const usersWithMethods = firestorm.collection<UserWithMethods>("users", (el) => {
	el.getNameAsLowerCase = (): string => el.name.toLowerCase();
	return el;
});

// we can use the methods in all results...
usersWithMethods.get("someKey").then((res) => res.getNameAsLowerCase());
// ...but cannot write or search for method fields
usersWithMethods.select({ fields: ["name", "family"] }); // getNameAsLowerCase not allowed here

/**
 * II. SEARCH THROUGH COLLECTIONS
 */

// 1. search through a collection
interface User {
	[firestorm.ID_FIELD]: string;
	name: string;
	age: number;
	sex: "female" | "male" | "other";
	family: string; // family id
	emails: string[];
}

const users = firestorm.collection<User>("users");

// search all users that have the name 'john' (not case sensitive)
users.search([{ field: "name", criteria: "==", value: "John", ignoreCase: true }]);

// search all users that have the name 'John' (case sensitive)
users.search([{ field: "name", criteria: "==", value: "John" }]);
users.search([{ field: "name", criteria: "==", value: "John", ignoreCase: false }]);

// search all users that have 'example@domain.net' in their emails
users.search([{ field: "emails", criteria: "array-contains", value: "example@domain.net" }]);

// search all users that have 'aha@domain.net' AND/OR 'ehe@domain.net' in their emails
users.search([
	{ field: "emails", criteria: "array-contains-any", value: ["aha@domain.net", "ehe@domain.net"] },
]);

// 2. collections can interface with each other
interface Family {
	[firestorm.ID_FIELD]: string;
	parents: User[];
	children: User[];
	getDad(): Promise<User>;
	getMom(): Promise<User>;
}

firestorm.collection<Family>("families", (el) => {
	el.getDad = (): Promise<User> =>
		users.search([
			// === family id
			{ field: "family", criteria: "==", value: el[firestorm.ID_FIELD] },
			{ field: "sex", criteria: "==", value: "male" },
		])[0];

	return el;
});

/**
 * III. METHODS WITH OBJECT PARAMETERS
 */

// editing one field
users.editField({
	id: "1291931", // the user you want to edit the field
	field: "age",
	operation: "set",
	value: 42,
});

// editing multiple fields
users.editFieldBulk([
	{
		id: "1291931",
		field: "age",
		operation: "set",
		value: 42,
	},
	{
		id: "e2ajr1df4apd", // it can be a different item in the collection
		field: "age",
		operation: "set",
		value: 69,
	},
]);

// selecting two fields those types and an ID field (always given)
users.select({ fields: ["age", "emails"] });

// select an array value with flatten mode will give a flattened type as a result
users.values({ field: "emails", flatten: true });

// flattening turned off gives an extra level of nesting, so the types reflect that
users.values({ field: "emails" });

// if not array type (can't really be flattened) it gets ignored
users.values({ field: "age", flatten: true });
