/*
Name: Rob Davis
Date: 11/12/2021
Description:
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
    let user = await db.get("SELECT user_id, username FROM users WHERE user_id = ?", authToken.user_id);
    req.user = user;
    next();
}

app.use(authMiddleware);

// initialize landing page based on if the user is logged in or not
app.get("/", async (req, res) => {
    if (!req.user) {
        return res.redirect("/login");
    }
    const db = await dbPromise;
    let tasks = await db.all("SELECT task_id, task_desc, is_complete FROM tasks WHERE user_id = ?", req.user.user_id);
    console.log(tasks);
    res.render("home", {layout: "main"});
})

app.get("/login", async (req, res) => {
    res.render("login", {layout: "main"});
})

app.get("/register", async (req, res) => {
    res.render("register", {layout: "main"});
})

app.get("/logout", async (req, res) => {
    res.clearCookie("authToken");
    res.redirect("/login");
})

app.post("/register", async (req, res) => {
    let username = req.body.username;
    let pass = req.body.password;
    let passConfirm = req.body.password_confirm;
    if (!username || !pass || !passConfirm) {
        return res.render("register", {error: "All fields required"});
    }
    if (pass !== passConfirm) {
        return res.render("register", {error: "Passwords must match"});
    }
    const db = await dbPromise;
    let check = await db.get("SELECT * FROM users WHERE username = ?", username);
    if (check != undefined) {
        return res.render("register", {error: "Username already exists"});
    }

    const hash = await bcrypt.hash(pass, 10);
    await db.run("INSERT INTO users (username, password) VALUES (?, ?)", username, hash);
    let newUser = await db.get("SELECT * FROM users WHERE username = ?", username);
    const token = uuid();
    await db.run("INSERT INTO authtokens (token, user_id) VALUES (?, ?)", token, newUser.user_id);
    res.cookie("authToken", token);
    res.redirect("/");
})

app.post("/login", async (req, res) => {
    let username = req.body.username;
    let pass = req.body.password;
    if (!username || !pass) {
        return res.render("login", {error: "All fields required"});
    }

    const db = await dbPromise;
    let userRequest = await db.get("SELECT * FROM users WHERE username = ?", username);
    console.log(userRequest);
    if (userRequest == undefined) {
        return res.render("login", {error: "Error: username or password incorrect"});
    }
    let same = await bcrypt.compare(pass, userRequest.password);
    if (!same) {
        return res.render("login", {error: "Error: username of password incorrect"});
    }

    const token = uuid();
    await db.run("INSERT INTO authtokens (token, user_id) VALUES (?, ?)", token, userRequest.user_id);
    res.cookie("authToken", token);
    res.redirect("/");
})

app.post("/add_task", async (req, res) => {
    let authtoken = req.cookies.authToken;
    let task_desc = req.body.task_desc;
    let db = await dbPromise;
    let user_id = await db.get("SELECT user_id FROM authtokens WHERE authtoken = ?", authtoken);
    await db.run("INSERT INTO tasks (user_id, task_desc, is_complete) VALUES (?, ?, ?)", user_id, task_desc, false);
    res.redirect("/");
})

app.listen(port, () => {
    console.log("Listening on port " + port);
});