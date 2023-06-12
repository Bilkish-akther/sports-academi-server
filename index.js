const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_KEY)

const port = process.env.PORT || 5000



app.use(cors())
app.use(express.json())


const jwtVerify = (req, res, next) => {
  const authorization = req.headers.authorization
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unathorization access' })
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SCRECT, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unathorization access' })
    }
    req.decoded = decoded;
    next()
  })
}



// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8efoi6h.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.efwmi0g.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const usersCollection = client.db("SportsAcademi").collection("users")
    const instractorCollection = client.db("SportsAcademi").collection("instractor")
    const classCollection = client.db("SportsAcademi").collection("class")
    const enrollCollection = client.db("SportsAcademi").collection("allEnroll")
    const paymentCollection = client.db("SportsAcademi").collection("payment")
    const addClassesCollection = client.db("SportsAcademi").collection("addClasses")



    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SCRECT, { expiresIn: '1hr' })
      res.send({ token })
    })




    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // get oparator
    app.get('/instractor', async (req, res) => {
      const result = await instractorCollection.find().toArray()
      res.send(result)
    })

    app.get('/class', async (req, res) => {
      const result = await classCollection.find().toArray()
      return res.send(result)
    })

    app.get('/enroll', jwtVerify, async (req, res) => {
      const email = req.query.email;
      // console.log(email)
      if (!email) {
        return res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: True, message: 'porviden access' })
      }

      const query = { email: email };
 
      const result = await enrollCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.get('/my-enroll-class', jwtVerify, async (req, res) => {
      const email = req.query.email;
    
      if (!email) {
        return res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: True, message: 'porviden access' })
      }

      const query = { email: email };
   
      const result = await paymentCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/users/admin/:email', jwtVerify, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.get('/addClasses', async(req, res)=>{
      const result = await addClassesCollection.find().toArray()
      res.send(result)
    
    })
    





    //  post mathod

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existing = await usersCollection.insertOne(query)

      if (existing) {
        return res.send({ message: 'user is alreaady existing' })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

    app.post('/all-enroll', async (req, res) => {
      const enroll = req.body;
      const result = await enrollCollection.insertOne(enroll);
      res.send(result)
    })


    app.post("/create-payment-intent", jwtVerify, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log(price, amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      });
    })


    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment)

      const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
      const deleteResult = await enrollCollection.deleteMany(query)

      res.send({ result: insertResult, deleteResult });
    })

    app.post('/addClass', async (req, res) => {
      const item = req.body;
      const result = await addClassesCollection.insertOne(item)
      res.send(result)

    })


    // fatche mathod



    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updateUser = {
        $set: {
          role: 'admin'
        },
      }
      const result = await usersCollection.updateOne(query, updateUser)
      res.send(result)
    })

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updateUser = {
        $set: {
          role: 'instructor'
        },
      }
      const result = await usersCollection.updateOne(query, updateUser)
      res.send(result)
    })




    // delete mathod





    app.delete('/enroll/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await enrollCollection.deleteOne(query)
      res.send(result)
    })



  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Sports Academi is Running ')
})
app.listen(port, () => {
  console.log(`check at first side ${port}`)
})



