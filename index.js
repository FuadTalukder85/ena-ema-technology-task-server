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
      const { limits = {}, ...updates } = req.body;

      // Validate that limits is an object
      if (typeof limits !== "object" || limits === null) {
        return res
          .status(400)
          .json({ error: "Invalid or missing 'limits' field" });
      }

      try {
        // Check if an entry for the current date exists
        let existingTask = await tasks.findOne({ date: formattedDate });

        if (existingTask) {
          // Update existing entry
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

              categoryData[newExpenseKey] = updates[category].expense || null;
              categoryData[newPurposeKey] = updates[category].purpose || null;
              categoryData.item = updates[category].item || null;
            } else {
              existingTask[category] = {
                limit: limits[category] || existingTask[category]?.limit || "0",
                ...updates[category],
              };
            }
          }
          await tasks.updateOne(
            { date: formattedDate },
            { $set: existingTask }
          );
          return res.send(existingTask);
        }

        // If no existing task for the date, create a new one
        const previousTask = await tasks
          .find({ month: monthName })
          .sort({ date: -1 })
          .limit(1)
          .toArray();

        const lastTask = previousTask[0] || null;

        const newTask = {
          date: formattedDate,
          month: monthName,
          groceries: {
            limit: limits.groceries || lastTask?.groceries?.limit || "0",
            ...updates.groceries,
          },
          transportation: {
            limit:
              limits.transportation || lastTask?.transportation?.limit || "0",
            ...updates.transportation,
          },
          healthcare: {
            limit: limits.healthcare || lastTask?.healthcare?.limit || "0",
            ...updates.healthcare,
          },
          utility: {
            limit: limits.utility || lastTask?.utility?.limit || "0",
            ...updates.utility,
          },
          charity: {
            limit: limits.charity || lastTask?.charity?.limit || "0",
            ...updates.charity,
          },
          miscellaneous: {
            limit:
              limits.miscellaneous || lastTask?.miscellaneous?.limit || "0",
            ...updates.miscellaneous,
          },
        };

        const result = await tasks.insertOne(newTask);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // GET all tasks
    app.get("/api/tasks", async (req, res) => {
      try {
        const result = await tasks.find().toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch tasks" });
      }
    });
    // Aggregated data
    app.get("/api/aggregated-tasks", async (req, res) => {
      try {
        const tasksList = await tasks.find().toArray();

        const categories = [
          "groceries",
          "transportation",
          "healthcare",
          "utility",
          "charity",
          "miscellaneous",
        ];

        // Group data by month
        const aggregatedData = tasksList.reduce((acc, task) => {
          const { month } = task;
          if (!acc[month]) {
            acc[month] = {
              _id: task._id,
              month,
              totalLimit: 0,
              totalExpense: 0,
              groceriesExpense: 0,
              transportationExpense: 0,
              healthcareExpense: 0,
              utilityExpense: 0,
              charityExpense: 0,
              miscellaneousExpense: 0,
            };

            categories.forEach((category) => {
              if (task[category]) {
                const categoryData = task[category];
                acc[month].totalLimit += parseInt(categoryData.limit || 0, 10);
              }
            });
          }
          const current = acc[month];
          categories.forEach((category) => {
            if (task[category]) {
              const categoryData = task[category];
              Object.keys(categoryData).forEach((key) => {
                if (key.startsWith("expense")) {
                  current[`${category}Expense`] += parseInt(
                    categoryData[key] || 0,
                    10
                  );
                  current.totalExpense += parseInt(categoryData[key] || 0, 10);
                }
              });
            }
          });

          return acc;
        }, {});

        const result = Object.values(aggregatedData);
        result.forEach((item) => {
          item.totalLimit = item.totalLimit.toLocaleString();
        });

        res.status(200).json(result);
      } catch (error) {
        console.error("Error in aggregation:", error);
        res.status(500).json({ error: "Failed to aggregate tasks" });
      }
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
