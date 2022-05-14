const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctorcluster.emai1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors-portal').collection('services');
        const appointmentCollection = client.db('doctors-portal').collection('appointment');
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services)
        })



        app.post('/appointment', async (req, res) => {
            const bookedAppointment = req.body;
            console.log(bookedAppointment);
            const query = {
                treatment: bookedAppointment.treatment,
                date: bookedAppointment.date,
                patient: bookedAppointment.patient
            }
            const exists = await appointmentCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, exists })
            }
            await appointmentCollection.insertOne(bookedAppointment);
            res.send({ success: true, bookedAppointment })
        })
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'may 15,2022';
            // step 1:get all services
            const services = await servicesCollection.find().toArray()
            // res.send(services)

            //step 2:get  booking of the day

            const query = { date: date };
            const booking = await appointmentCollection.find().toArray();
            //step 3 
            services.map(service => {
                const serviceBooking = booking.filter(b => b.treatment === service.name);
                const booked = serviceBooking.map(s => s.slot);
                const available = service.slots.filter(s => !booked.includes(s))
                service.available = available
            })
            res.send(services)
        })

    }
    finally {

    }

}

run().catch(console.dir)
app.get('/', (req, res) => {
    res.send('hello world')
})
app.listen(port, () => {
    console.log('port running');
})