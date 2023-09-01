import { TestTimeLock } from "../typechain-types";

type testTimeLockFunction = "getName" | "setName";

function encodedFunction(testTimeLock: TestTimeLock, func: testTimeLockFunction) {
  let encodedData = "";
  switch (func) {
    case "getName":
      // const functionSignature = testTimeLock.interface.getFunction(func).format();
      encodedData = testTimeLock.interface.encodeFunctionData(func);
      break;

    case "setName":
      const newValue = "New name";
      encodedData = testTimeLock.interface.encodeFunctionData(func, [newValue]);
      break;
  }
  return encodedData;
}

export default encodedFunction;
