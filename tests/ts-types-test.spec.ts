// VS-Code stress test for TypeScript types of Firestorm-db.
import * as firestorm from "../typings/index";

/**
 ** I. CREATE A COLLECTION
 **/

// let's declare an interface for our collection
interface User {
	name: string;
}

// then we use that interface in our collection
firestorm.collection<User>("users");

// we can also declare a collection with methods,
// those methods should be implemented in the interface too
interface UserWithMethods extends User {
	getNameAsLowerCase: () => string;
}

firestorm.collection<UserWithMethods>("users", (col) => {
	col.getNameAsLowerCase = (): string => col.name.toLowerCase();

	return col;
});

/**
 ** II. SEARCH THROUGH COLLECTIONS
 **/

// 1. search through a collection
interface User {
	name: string;
	age: number;
	sex: "female" | "male" | "other";
	family: string; // family id
	emails: string[];
}

const users = firestorm.collection<User>("users");

// search all users that have the name 'john' (not case sensitive)
users.search([{ field: "name", criteria: "==", value: "John", ignoreCase: true }]);

// search all users that have the name 'john' (case sensitive)
users.search([{ field: "name", criteria: "==", value: "John" }]);
users.search([{ field: "name", criteria: "==", value: "John", ignoreCase: false }]);

// search all users that have 'example@domain.net' in their emails
users.search([{ field: "emails", criteria: "array-contains", value: "example@domain.net" }]);

// search all users that have 'aha@domain.net' AND/OR 'ehe@domain.net' in their emails
users.search([
	{ field: "emails", criteria: "array-contains-any", value: ["aha@domain.net", "ehe@domain.net"] },
]);

// 2. collections can interfere with each other
interface Family {
	parents: User[];
	children: User[];
	getDad(): Promise<User>;
	getMom(): Promise<User>;
}

firestorm.collection<Family>("families", (col) => {
	col.getDad = (): Promise<User> =>
		users.search([
			//! TODO - needs clarification
			// firestorm.ID_FIELD refers to id of the 'asked object' of the collection
			// === family id
			{ field: "family", criteria: "==", value: firestorm.ID_FIELD },
			{ field: "sex", criteria: "==", value: "male" },
		])[0];

	return col;
});

/**
 ** III. EDIT FIELDS OF AN ITEM IN A COLLECTION
 **/

// editing 1 field
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
