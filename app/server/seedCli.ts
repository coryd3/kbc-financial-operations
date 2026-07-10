import { pool } from "./db.ts";
import { seed } from "./seed.ts";

seed()
  .then(() => {
    console.log("Baseline seed completed.");
  })
  .finally(() => pool.end());
