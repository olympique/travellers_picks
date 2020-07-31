var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var middleware = require("../middleware");

// NEW route - show form to create a new comment
router.get("/campgrounds/:slug/comments/new", middleware.isLoggedIn, function(req, res){
	Campground.findOne({slug: req.params.slug}, function(err, campground){
		if(err){
			console.log(err);
		} else {
			res.render("comments/new", {campground:campground});
		}
	});
});

// Create route - create a new comment
router.post("/campgrounds/:slug/comments", middleware.isLoggedIn, function(req, res){
	Campground.findOne({slug: req.params.slug}, function(err, campground){
		if(err){
			console.log(err);
			res.redirect("/campgrounds");
		} else {
			// create new comment
			Comment.create(req.body.comment, function(err, comment){
				if(err){
					req.flash("error", "Something went wrong!");
					console.log(err);
				} else {
					// add username and id to comment
					comment.author.id = req.user._id;
					comment.author.username = req.user.username;
					comment.save();
					// connect new comment to campground
					campground.comments.push(comment);
					campground.save();
					// redirect campground show page
					req.flash("success", "Successfully added comment!");
					res.redirect("/campgrounds/" + campground.slug);
				}
			});
		}
	});
});

// Edit route - show form to edit a comment
router.get("/campgrounds/:slug/comments/:comment_id/edit", middleware.checkCommentOwnership, function(req, res){
	Campground.findOne({slug: req.params.slug}, function(err, foundCampground){
		if(err || !foundCampground){
			req.flash("error", "Campground not found!");
			return res.redirect("back");
		}
		Comment.findById(req.params.comment_id, function(err, foundComment){
			if(err){
				res.redirect("back");
			} else {
			res.render("comments/edit", {campground_slug: req.params.slug, comment: foundComment});
			}
		});
	});
});

// Update route - update a comment
router.put("/campgrounds/:slug/comments/:comment_id", middleware.checkCommentOwnership, function(req, res){
   	Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
		if(err){
          res.redirect("back");
      	} else {
          res.redirect("/campgrounds/" + req.params.slug);
      	}
   	});
});

// Destroy route - delete a comment
router.delete("/campgrounds/:slug/comments/:comment_id", middleware.checkCommentOwnership, function(req, res){
	Comment.findByIdAndRemove(req.params.comment_id, function(err){
    	if(err){
           res.redirect("back");
       	} else {
			req.flash("success", "Successfully deleted comment!");
           	res.redirect("/campgrounds/" + req.params.slug);
       	}
    });
});

module.exports = router;