/*
Name: Rob Davis
Date: 11/12/2021
Description:
*/

// initialize the dependencies
const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");
const express = require("express");
const app = express();
const handlebars = require("express-handlebars");
const cookieParser = require("cookie-parser");

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

// initialize landing page based on if the user is logged in or not
app.get("/", (req, res) => {
    
})