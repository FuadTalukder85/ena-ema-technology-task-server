const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 2025;

// middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const db = client.db("enaEma");
    const tasks = db.collection("tasks");

    // POST tasks
    app.post("/api/tasks", async (req, res) => {
      const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const monthName = date.toLocaleString("default", { month: "long" });
        return {
          formattedDate: `${day}.${month}.${year}`,
          monthName,
        };
      };

      const { formattedDate, monthName } = formatDate(new Date());
      // Check if an entry for the current date already exists
      let existingTask = await tasks.findOne({ date: formattedDate });
      if (existingTask) {
        const updates = req.body;
        for (const category in updates) {
          if (existingTask[category]) {
            const categoryData = existingTask[category];
            const newExpenseKey = `expense${
              Object.keys(categoryData).filter((key) =>
                key.startsWith("expense")
              ).length + 1
            }`;
            const newPurposeKey = `purpose${
              Object.keys(categoryData).filter((key) =>
                key.startsWith("purpose")
              ).length + 1
            }`;
            if (updates[category].expense) {
              categoryData[newExpenseKey] = updates[category].expense;
            }
            if (updates[category].purpose) {
              categoryData[newPurposeKey] = updates[category].purpose;
            }
            if (updates[category].item) {
              categoryData.item = updates[category].item;
            }
          } else {
            existingTask[category] = { ...updates[category] };
          }
        }
        await tasks.updateOne({ date: formattedDate }, { $set: existingTask });
        return res.send(existingTask);
      }
      const lastEntry = await tasks
        .find({})
        .sort({ date: -1 })
        .limit(1)
        .toArray();
      const defaultValues = lastEntry[0] || {};
      const newTask = {
        date: formattedDate,
        month: monthName,
        groceries: {
          limit: defaultValues.groceries?.limit || 0,
          ...req.body.groceries,
        },
        transportation: {
          limit: defaultValues.transportation?.limit || 0,
          ...req.body.transportation,
        },
        healthcare: {
          limit: defaultValues.healthcare?.limit || 0,
          ...req.body.healthcare,
        },
        utility: {
          limit: defaultValues.utility?.limit || 0,
          ...req.body.utility,
        },
        charity: {
          limit: defaultValues.charity?.limit || 0,
          ...req.body.charity,
        },
        miscellaneous: {
          limit: defaultValues.miscellaneous?.limit || 0,
          ...req.body.miscellaneous,
        },
      };

      const result = await tasks.insertOne(newTask);
      res.send(result);
    });
    // Root
    app.get("/", (req, res) => {
      const serverStatus = {
        message: "Server is running smoothly",
        timestamp: new Date(),
      };
      res.json(serverStatus);
    });

    app.listen(port, () => {
      console.log("run");
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
