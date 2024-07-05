const express = require("express");
const app = express();
const port = 8080;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const multer = require('multer');
const methodOverride = require('method-override');
const mysql = require('mysql2');

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));

app.use(express.static(path.join(__dirname, "public/css")));
app.use(express.static(path.join(__dirname, "public/images")));

app.use(express.urlencoded({ extended: true }));  //override with POST having ?_method=PATCH
app.use(express.json());
app.use(methodOverride('_method'));  //override with POST having ?_method=PATCH

const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'Root@123',
  database : 'linkedin'
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage: storage });

app.get("/posts", (req, res) => {
  let q = "select * from posts order by username" ;
  try{
        connection.query( q, function (error, results) {
            if (error) throw error;
           // Parse comments to count them
          let posts = results.map(post => {
            post.comments = post.comments ? JSON.parse(post.comments) : [];
            post.commentsCount = post.comments.length;
            return post;
          });
            res.render("index.ejs", { posts });            
        });
     } catch(e){
        console.log(e);
        res.send("error in database");
     }   
});

app.get("/posts/new", (req, res) => {
  res.render("new.ejs");
});

app.post("/posts", upload.single('image'), (req, res) => {
  const { username, content } = req.body;
  const image = req.file ? req.file.filename : null;
  let likes = 0;
  let reposts = 0;
  let comments = "";
  const id = uuidv4();
  let q = `INSERT INTO posts (id, username, content, image, likes, repost, comments) VALUES ?`;
  let post = [];
  post.push([id, username, content, image,likes, reposts,comments]);  //insert data into the table using form
  try{
    connection.query( q, [ post ], function (error, results) {
        if (error) throw error;
        res.redirect("/posts");
      });
    } catch(e){
          console.log(e);
          res.send("error in database");
  }  
   
});

app.get("/posts/:id", (req, res) => {
  let { id } = req.params;
  let q = `select * from posts where id = '${id}'` ;
  try{
        connection.query( q, function (error, results) {
            if (error) throw error;
            let post = results[0];
            res.render("profile.ejs", { post });    
        });
     } catch(e){
        console.log(e);
        res.send("error in database");
     } 
 
});

app.get("/posts/:id/comments", (req, res) => {
  const { id } = req.params;
  let q = `SELECT * FROM posts WHERE id = ?`;
  connection.query(q, [id], function (error, results) {
    if (error) {
      console.log(error);
      return res.send("Error in database");
    }
    let post = results[0];
    let comments = post.comments ? JSON.parse(post.comments) : [];
    post.commentsCount = post.comments.length;
    res.render("comments.ejs", { post });
  });
});

app.patch("/posts/:id/comments", (req, res) => {
  const { id } = req.params;
  const newComment = req.body.comments;  
  if (!newComment) {
    // If the new comment is empty, redirect back or show an error
    return res.send("Comment cannot be empty");
  }
  // Fetch the current comments for the post
  let q = `SELECT comments FROM posts WHERE id = ?`;
  connection.query(q, [id], function (error, results) {
    if (error) {
      console.log(error);
      return res.send("Error in database");
    }
    let post = results[0];
    let comments = post.comments ? JSON.parse(post.comments) : [];    
    
    comments.push(newComment);  // Add the new comment to the list    
    let q2 = `UPDATE posts SET comments = ? WHERE id = ?`;  // Update the comments column in the database
    connection.query(q2, [JSON.stringify(comments), id], function (error, results) {
      if (error) {
        console.log(error);
        return res.send("Error in database");
      }
      res.redirect(`/posts/${id}/comments`);
    });
  });
});
// ROUTE TO GET THE COUNT OF LIKES
  app.get("/posts/:id/likes", (req, res) => {
    const { id } = req.params;
    let q = `SELECT likes FROM posts WHERE id = '${ id }'`;
    connection.query(q, function (error, results) {
      let post = results[0];
      let newLikes = post.likes + 1;
  
      let q2 = `UPDATE posts SET likes = ? WHERE id = '${ id }'`;
      connection.query(q2, [newLikes, id], function (error, results) {
        if (error) {
          console.log(error);
          return res.send("Error in database");
        }
        res.redirect("/posts");
      });
    });
   
  });

  app.post("/posts/:id/repost", (req, res) => {
    const { id } = req.params;
    let likes = 0;
    let reposts = 0;
    let comments = "";
    const repostId = uuidv4();
    let q = `select * from posts where id ='${id}'`;
    try{
       connection.query( q, function (error, results) {
          if (error) throw error;
          let post = results[0];
          let repostUsername = post.username;
          let repostImage = post.image;
          let repostContent = post.content;
  
          let q2 = `INSERT INTO posts (id, username, content, image, likes, repost, comments) VALUES ? `;
          let post1 = [];
          post1.push( [repostId,repostUsername,repostContent,repostImage, likes, reposts ,comments]);
          
          connection.query(q2,[post1], function (error, results) {
            if (error) {
              console.log(error);
              return res.send("Error in database");
            }
            // Increment the repost count in the original post
            let newRepostCount = post.repost + 1;
            let q3 = `UPDATE posts SET repost = ? WHERE id = ?`;
            connection.query(q3, [newRepostCount, id], function (error, results) {
                if (error) {
                    console.log(error);
                    return res.send("Error in update query");
                }
                res.redirect("/posts");
            });
              
            });
          }); 
      
      } catch(e){
          console.log(e);
          res.send("error in database");
    } 
      
  });
    
 //UPDATE THE USERS DATA IN DB ROUTE

  app.patch("/posts/:id", (req,res) => {
  let { id } = req.params;
  let newContent = req.body.content;  
  
  let q = `select * from posts where id ='${id}'`;
  try{
    connection.query( q, function (error, results) {
        if (error) throw error;
        let post = results[0];
        let q2 = `update posts set content = '${newContent}' where id = '${id}'`;
        connection.query( q2, function (error, results) {
          if (error) throw error;
          res.redirect("/posts");
          });  
        });
    } catch(e){
          console.log(e);
          res.send("error in database");
    }    
}); 

// EDIT ROUTE TO REACH UPDATE FORM
  app.get("/posts/:id/update", (req, res) => {
    let { id } = req.params;
    let q = `select * from posts where id ='${id}'`;
    try{
      connection.query( q, function (error, results) {
          if (error) throw error;
          let post = results[0];
          res.render("update-content.ejs",{ post });
        });
      } catch(e){
            console.log(e);
            res.send("error in database");
    }  
    
  });  

  // Delete Route
  app.delete("/posts/:id", (req,res) => {
    let { id } = req.params; 
  
    let q = `SELECT * FROM posts WHERE id = ?`;
    connection.query(q, [id], function (error, results) {
      if (error) throw error;
      let post = results[0];
      let q2 = `DELETE FROM posts WHERE id = ?`;
        connection.query(q2, [id], function (error, results) {
          if (error) throw error;
          res.redirect("/posts");
       });
    });
  }); 

  app.get("/search", (req, res) => {
    const { userSearch } = req.query;
    let { username } = req.params;   
    let q = `select * from posts where username = ?`;
    try{
      connection.query( q, [userSearch], function (error, results) {
        if (results.length === 0) {
          return res.send("No result found");
        }
        res.render("search.ejs", { posts: results });
       });
      } catch(e){
            console.log(e);
            res.send("error in database");
      }   
    
  });

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
