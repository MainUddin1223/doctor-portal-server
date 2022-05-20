const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');

const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken')
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

const verifyJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next()
    })

}

const emailOptions = {
    auth: {
        api_key: process.env.EMAIL_SENDER_KEY
    }
}
const emailClient = nodemailer.createTransport(sgTransport(emailOptions));
function sendAppointmentEmail(bookedAppointment) {
    const { email, patient, treatment, date, slot } = bookedAppointment;
    const sendEmail = {
        from: process.env.EMAIL_SENDER,
        to: email,
        subject: `Your Appointment for ${treatment} is on ${date} at ${slot} is confirmed`,
        text: `Your Appointment for ${treatment} is on ${date} at ${slot} is confirmed`,
        html: `
        <div>
       <p>Hello ${patient},</p> 
       <h3>your appointment for ${treatment} is confirmed</h3>
       <p>Looking forward to seeing you on ${date} at ${slot}</p> 
       <h3>Our Address</h3> 
       <p>Dhaka,Bangladesh</p> 
       <a href="https://web.programming-hero.com/">Unsubscribe</a> 
        </div>
        `
    };
    emailClient.sendMail(sendEmail, function (err, info) {
        if (err) {
            console.log(err);
        }
        else {
            console.log('Message sent: ', info);
        }
    });


}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctorcluster.emai1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors-portal').collection('services');
        const appointmentCollection = client.db('doctors-portal').collection('appointment');
        const usersCollection = client.db('doctors-portal').collection('users');
        const doctorCollection = client.db('doctors-portal').collection('doctors');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' })
            }
        }

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query).project({ name: 1 });
            const services = await cursor.toArray();
            res.send(services)
        })

        //
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send({ result, token })

        })
        //

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })
        //
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })


        app.get('/users', async (req, res) => {
            const query = {};
            const cursor = usersCollection.find(query);
            const users = await cursor.toArray();
            res.send(users)
        })

        app.post('/appointment', async (req, res) => {
            const bookedAppointment = req.body;
            const query = {
                treatment: bookedAppointment.treatment,
                date: bookedAppointment.date,
                patient: bookedAppointment.patient
            }
            const exists = await appointmentCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, exists })
            }
            const result = await appointmentCollection.insertOne(bookedAppointment);
            console.log(`sending email`);
            sendAppointmentEmail(bookedAppointment)
            res.send({ success: true, result })
        })
        app.get('/available', verifyJWT, async (req, res) => {
            const date = req.query.date;
            // step 1:get all services
            const services = await servicesCollection.find().toArray();

            //step 2:get  booking of the day

            const query = { date: date };
            const booking = await appointmentCollection.find(query).toArray();
            //step 3 
            services.forEach(service => {
                const serviceBooking = booking.filter(b => b.treatment === service.name);
                // returns an array with the values that pass the filter.
                const booked = serviceBooking.map(s => s.slot);
                // returns a new array
                const available = service.slots.filter(s => !booked.includes(s))
                service.slots = available;
            })
            res.send(services)
        })

        app.get('/appointment', async (req, res) => {
            const patient = req.query.patient;
            const query = { email: patient };
            const bookings = await appointmentCollection.find(query).toArray();
            res.send(bookings)
        })



        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result)
        })
        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctors = await doctorCollection.find().toArray();
            res.send(doctors)
        })

        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await doctorCollection.deleteOne(filter);
            res.send(result)
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