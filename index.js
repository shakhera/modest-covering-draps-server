const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster7.gvmlsqj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster7`;

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
    // await client.connect();

    const productCollection = client.db("modestDrapsDb").collection("products");
    const cartsCollection = client.db("modestDrapsDb").collection("carts");
    const categoryCollection = client
      .db("modestDrapsDb")
      .collection("categories");
    const paymentCollection = client.db("modestDrapsDb").collection("payments");

    // category related api
    app.get("/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });
    app.get("/products", async (req, res) => {
      const { rating, minPrice, maxPrice } = req.query;

      // console.log(rating, minPrice, maxPrice);
      let query = {};
      if (isNaN(minPrice) && isNaN(maxPrice) && isNaN(rating)) {
        query = {};
      } else if (minPrice && maxPrice && isNaN(rating)) {
        query = {
          price: {
            $lte: parseInt(maxPrice),
            $gte: parseInt(minPrice),
          },
        };
      } else if (minPrice && maxPrice && rating) {
        query = {
          price: {
            $lte: parseInt(maxPrice),
            $gte: parseInt(minPrice),
          },
          ratings: parseInt(rating),
        };
      } else if (isNaN(minPrice) && isNaN(maxPrice) && rating) {
        query = {
          ratings: parseInt(rating),
        };
      }

      const result = await productCollection.find(query).toArray();
      res.send(result).status(200);
    });
    app.get("/product", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const category = req.query.category || "All";
      // console.log(page, size);
      let query = {};
      if (category !== "All") {
        query = { category: category };
      }
      const cursor = productCollection.find(query);
      const products = await cursor
        .skip(page * size)
        .limit(size)
        .toArray();
      const count = await productCollection.estimatedDocumentCount();
      res.send({ count, products });
    });

    // cart related api
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/carts", async (req, res) => {
      const item = req.body;

      const result = await cartsCollection.insertOne(item);
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    // PAYMENT related api

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.get("/payment/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // carefully delete each item from item cart
      // console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.cartId.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartsCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
