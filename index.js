/*
Name: Rob Davis
Date: 11/17/2021
Description: This is an update to the last to-do assignment, where logging in now requires a password that is hashed and stored, and the website keeps an authToken to keep people logged in
*/

// initialize the dependencies-- note that I am using handlebars v5.3
const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");
const express = require("express");
const app = express();
const handlebars = require("express-handlebars");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const { uuid } = require('uuidv4');

const port = 8080;

// set up the engines
app.engine("handlebars", handlebars());
app.set("view engine", "handlebars");

// prepare handlebars and the cookie parser
app.use(express.static("static"));
app.use(express.urlencoded( {extended: false}));
app.use(cookieParser());

// this allows us to access our database
const dbPromise = sqlite.open({
    filename: "./database/todolist.sqlite",
    driver: sqlite3.Database
});

// this middleware function checks if the user has a valid cookie and authtoken
const authMiddleware = async (req, res, next) => {
    if (!req.cookies || !req.cookies.authToken) {
        console.log("Didn't find a cookie or an authToken");
        return next();
    }
    const db = await dbPromise;
    let authToken = await db.get("SELECT * FROM authtokens WHERE token = ?", req.cookies.authToken);
    if (!authToken) {
        console.log("Didn't find an user with this authToken");
        return next();
    }
    // if they do, write their info to req.user
    let user = await db.get("SELECT user_id, username FROM users WHERE user_id = ?", authToken.user_id);
    req.user = user;
    next();
}

app.use(authMiddleware);

// initialize landing page based on if the user is logged in or not
app.get("/", async (req, res) => {
    // if there is no req.user object, no one is logged in so we send the user back to the login page
    if (!req.user) {
        return res.redirect("/login");
    }
    // otherwise, query the tasks using the user_id from the cookie and display them for the user
    const db = await dbPromise;
    let tasks = await db.all("SELECT task_id, task_desc, is_complete FROM tasks WHERE user_id = ?", req.user.user_id);
    console.log(tasks);
    res.render("home", {layout: "main", username: req.user.username, tasks: tasks});
})

// on the login page, simply render the login view with the main format
app.get("/login", async (req, res) => {
    res.render("login", {layout: "main"});
})

// on the register page, simply render the register view wiht the main format
app.get("/register", async (req, res) => {
    res.render("register", {layout: "main"});
})

// if the user clicks logout, delete the cookie and send them to the login screen
app.get("/logout", async (req, res) => {
    res.clearCookie("authToken");
    res.redirect("/login");
})

// the post for register
app.post("/register", async (req, res) => {
    // first, grab the desired username, password, and password confirmation
    let username = req.body.username;
    let pass = req.body.password;
    let passConfirm = req.body.password_confirm;
    // if one of them is empty, update the error message and re-render the page
    if (!username || !pass || !passConfirm) {
        return res.render("register", {error: "All fields required"});
    }
    // if the password and password confirmation don't match, update and redirect them
    if (pass !== passConfirm) {
        return res.render("register", {error: "Passwords must match"});
    }
    // if they get through, we query to check if there is already a username for their query
    const db = await dbPromise;
    let check = await db.get("SELECT * FROM users WHERE username = ?", username);
    if (check != undefined) {
        // if it is, update the error message and re-render
        return res.render("register", {error: "Username already exists"});
    }

    // if there is no desired username, we hash their password
    const hash = await bcrypt.hash(pass, 10);
    // we then insert the username and hashed password into the database and get the object back
    await db.run("INSERT INTO users (username, password) VALUES (?, ?)", username, hash);
    let newUser = await db.get("SELECT * FROM users WHERE username = ?", username);
    // we create an auth token using uuid and put that and the user_id into the authtokens table
    const token = uuid();
    await db.run("INSERT INTO authtokens (token, user_id) VALUES (?, ?)", token, newUser.user_id);
    // finally, write the token to a cookie and redirect the user to the home page, logging them in automatically
    res.cookie("authToken", token);
    res.redirect("/");
})

// the post for login
app.post("/login", async (req, res) => {
    // get the username and password inputs
    let username = req.body.username;
    let pass = req.body.password;
    // if one is empty, update the error message and reload the page
    if (!username || !pass) {
        return res.render("login", {error: "All fields required"});
    }
    // check that there is a user with the queried username
    const db = await dbPromise;
    let userRequest = await db.get("SELECT * FROM users WHERE username = ?", username);
    if (userRequest == undefined) {
        // if there is not, update the error and reload
        return res.render("login", {error: "Error: username or password incorrect"});
    }
    // next, use bcrypt.compare to check if the inputted password will match the stored hashed password
    let same = await bcrypt.compare(pass, userRequest.password);
    if (!same) {
        // if they are not, update the error and reload the page
        return res.render("login", {error: "Error: username of password incorrect"});
    }
    // if it passes, create a new token, put it into the database
    const token = uuid();
    await db.run("INSERT INTO authtokens (token, user_id) VALUES (?, ?)", token, userRequest.user_id);
    // then make a cookie out of the token and go to home
    res.cookie("authToken", token);
    res.redirect("/");
})

app.post("/add_task", async (req, res) => {
    // get the task description input
    let task_desc = req.body.task_desc;
    // get the user_id from the user object that was created by the middleware
    let user_id = req.user.user_id;
    // insert the corresponding data into the database, then reload the page and it will display
    let db = await dbPromise;
    await db.run("INSERT INTO tasks (user_id, task_desc, is_complete) VALUES (?, ?, ?)", user_id, task_desc, false);
    res.redirect("/");
})

// listen on 8080 and log to the console
app.listen(port, () => {
    console.log("Listening on port " + port);
});