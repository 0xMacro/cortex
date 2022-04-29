import { OperationTypes } from "../enums/operations.js";

export function createOperation(operation) {
  const { type, params, output } = operation;

  switch (type) {
    case OperationTypes.GET_DATA:
      return `get(${params}, ${output})`;

    case OperationTypes.CALL_FN:
      const [contract_name, fn] = params;
      const [fn_name, ...inputs] = fn;
      const fn_inputs = inputs.length ? `(${inputs.join(",")})` : "";
      return `call_fn(${contract_name}, ${fn_name}${fn_inputs}, [${output}])`;

    default:
      return "";
  }
}

export function createBooleanPredicate(predicate_name, operations, condition) {
  const predicate_output = "Bool";
  const head = `${predicate_name}(${predicate_output})`;
  const body = operations.map(createOperation);
  body.push(
    `((${condition}) == ${predicate_output} -> ${predicate_output} = true; ${predicate_output} = false)`
  );

  return `${head} :- ${body.join(", ")}.`;
}

// console.log(
//   createBooleanPredicate(
//     "has_paid",
//     [
//       {
//         type: "getData",
//         params: "me/address",
//         output: "ConnectedAddress",
//       },
//       {
//         type: "callFn",
//         params: ["tuition", ["alreadyPaid", "ConnectedAddress"]],
//         output: ["AlreadyPaid"],
//       },
//     ],
//     "AlreadyPaid"
//   )
// );

// console.log(
//   createBooleanPredicate(
//     "is_owner",
//     [
//       {
//         type: "getData",
//         params: "me/address",
//         output: "ConnectedAddress",
//       },
//       {
//         type: "callFn",
//         params: ["tuition", ["owner"]],
//         output: ["Owner"],
//       },
//     ],
//     "ConnectedAddress == Owner"
//   )
// );
