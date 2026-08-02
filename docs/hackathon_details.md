# **Marketplace - Hackathon**

# 🎯 **Overview**

The objective of this challenge is to design and develop a functional prototype of a B2B Textile Marketplace that connects buyers and suppliers through a modern, responsive web application.

Rather than building a fully production-ready platform, participants are expected to demonstrate the core marketplace experience, showcasing how buyers discover products and how suppliers manage their inventory and incoming orders.

The emphasis should be on **product thinking, user experience, clean architecture, scalability, and implementation quality**, rather than implementing every business feature.

> **Note:** Payment processing, escrow, logistics management, delivery workflows, and administrative dashboards are **outside the scope** of this prototype.
> 

# 💡 **Task Objective**

Build a responsive web application that successfully demonstrates the primary marketplace workflow between buyers and suppliers.

Participants should focus on creating a polished and intuitive experience while ensuring that the application is structured in a way that could be extended into a production-ready platform in the future.

The prototype should clearly showcase both sides of the marketplace and how they interact with each other.

# ⚙️ **Prototype Scope**

The prototype consists of two primary modules:

Buyer Experience

Supplier Experience

Both modules should share a common backend and database while maintaining separate user experiences based on authentication and user roles.

## **📌 Module 1 — Buyer Experience**

The Buyer Experience should simulate the complete purchasing journey, from discovering fabrics to placing an order.

The focus should be on creating a smooth, responsive, and intuitive shopping experience that allows users to easily browse products and interact with the marketplace.

### **Marketplace Discovery**

Develop a marketplace homepage where buyers can browse available fabrics through a clean and modern interface.

The marketplace should include:

Landing Page

Responsive Navigation

Featured Products

Product Categories

Product Search

Product Filtering

Product Listing/Grid View

Participants are encouraged to pay attention to usability, loading performance, and overall browsing experience.

### **AI Marketplace Assistant**

The marketplace should include an integrated AI assistant available throughout the buyer journey.

The AI assistant should support:

Conversational Chat

Voice-based Assistance

Natural Language Search

Fabric Recommendations

Product Comparison

Similar Product Suggestions

Product Q&A

The AI should use marketplace data stored in the database to recommend relevant products. Traditional browsing, search, and filtering should remain fully functional regardless of AI usage.

### **Product Details**

Each product should have a dedicated page displaying complete product information.

Suggested information includes:

Product Images

Product Name

Category

Description

Available Colors

Product Specifications

Available Stock

Price

Add to Cart

The interface should make it easy for buyers to evaluate products before purchasing.

### **Buyer Authentication**

Implement a simple authentication system allowing buyers to:

Register

Login

Logout

Basic profile management is encouraged but can remain minimal.

### **Buyer Onboarding**

After registration, buyers should complete a simple onboarding experience to help personalize the marketplace.

The onboarding should collect relevant information such as:

Business Type

Industry

Product Categories of Interest

Preferred Fabric Types

Typical Order Quantity

Budget Range

Any additional preferences relevant to the marketplace

The onboarding experience should be smooth, intuitive, and user-friendly. Participants are encouraged to leverage AI in a meaningful way, such as through a conversational chat interface or voice-assisted onboarding, instead of relying solely on traditional forms. The implementation is flexible, provided it simplifies the onboarding process and enhances the overall user experience.

### **Shopping Cart**

Buyers should be able to manage their shopping cart by:

Adding Products

Updating Quantities

Removing Products

Viewing Order Summary

The shopping experience should closely resemble a modern e-commerce platform.

### **Checkout Prototype**

Since payments are outside the scope, implement a simplified checkout experience.

The checkout should include:

Shipping Information

Order Summary

Order Review

Place Order

Order Confirmation

No payment gateway integration is required.

### **Buyer Dashboard**

Provide a simple buyer dashboard where users can:

View Profile

View Previous Orders

View Current Orders

Track Basic Order Status

Mock order history is acceptable.

## **📌 Module 2 — Supplier Experience**

The Supplier Experience should demonstrate how suppliers interact with the marketplace to manage their products and fulfill incoming customer orders.

The interface should prioritize operational simplicity and efficient inventory management.

### **Supplier Onboarding**

After registration, suppliers should complete a simple onboarding experience to set up their business profile before listing products.

The onboarding should collect relevant information such as:

Business Name

Business Type

Contact Information

Business Address

Operating Hours

Product Categories

Types of Fabrics Offered

Minimum Order Quantity (MOQ)

Any additional business information relevant to the marketplace

The onboarding experience should be smooth, intuitive, and user-friendly. Participants are encouraged to leverage AI in a meaningful way, such as through a conversational chat interface or voice-assisted onboarding, instead of relying solely on traditional forms. The implementation is flexible, provided it simplifies the onboarding process and helps suppliers quickly set up their marketplace profile and begin managing their inventory.

### **Supplier Dashboard**

Develop a dashboard that provides suppliers with a quick overview of marketplace activity.

Suggested widgets include:

Total Products

Active Products

Pending Orders

Recent Orders

Inventory Alerts

The dashboard should help suppliers quickly understand their current business activity.

### **Inventory Management**

Suppliers should be able to manage their product catalog through an intuitive interface.

Core functionality includes:

Add New Product

Edit Product

Delete Product

Update Inventory

Upload Product Images

Mark Products as Available or Out of Stock

Participants are encouraged to design a clean product management workflow.

### **Order Management**

Suppliers should be able to receive and manage customer orders.

The prototype should allow suppliers to:

View Incoming Orders

View Order Details

Update Order Status

Suggested statuses include:

Pending

Accepted

Preparing

Ready for Dispatch

Completed

This workflow can be simulated without requiring delivery integration.

### **Supplier Profile**

Implement a simple supplier profile where users can manage:

Business Name

Contact Information

Business Address

Operating Hours

Additional profile fields may be added if required.

### **Additional Creativity**

This assignment intentionally focuses on a simple but functional marketplace prototype. Once all core requirements are implemented and working end-to-end, participants are encouraged to showcase their creativity by introducing additional features that enhance the overall user experience.

These enhancements may include AI-powered experiences, improved UI/UX, innovative product discovery, analytics, accessibility improvements, performance optimizations, or any other thoughtful ideas that add value to the marketplace.

There are no restrictions on creativity, provided that the core marketplace workflows remain fully functional and the additional features are well-designed, purposeful, and integrated into the overall product experience.

Submissions that demonstrate strong product thinking, attention to detail, and creative problem-solving while maintaining high engineering quality are encouraged.

## **💻 Technical Expectations**

Participants are free to choose their preferred technology stack.

However, the prototype should demonstrate good engineering practices and should ideally include:

Responsive Web Design

Mobile-Friendly Experience

Authentication & Authorization

Backend API Development

Database Integration

Clean Project Structure

Reusable Components

Proper State Management

Basic Form Validation

Well-Organized Codebase

Git Version Control

#### **Frontend**

Participants are expected to build a responsive web application using modern frontend technologies. The preferred stack is:

React.js

Next.js *(Optional)*

HTML5, CSS3

Tailwind CSS / Material UI / Bootstrap *(Any UI framework is acceptable)*

The application should provide a clean, responsive, and intuitive user experience across desktop and mobile browsers.

#### **Backend**

The preferred backend stack is:

Node.js

Participants should implement well-structured RESTful APIs to support the marketplace workflows.

#### **Database**

Participants may use any of the following databases:

MongoDB

PostgreSQL

MySQL

The database should be properly designed to support user authentication, products, inventory, shopping carts, and orders.

#### **Authentication**

Participants should implement a secure authentication system for both Buyers and Suppliers.

Suggested approaches include:

JWT Authentication

Session-based Authentication

Role-based access control should be implemented to distinguish Buyer and Supplier experiences.

#### **AI Modal**

Participants are welcome to enhance their solution using AI-powered features such as:

Smart product search

Product recommendations

Semantic search

Intelligent product categorization

Natural language search

These features will be considered bonus implementations. 

We would prefer you to use a custom LLM from Hugging Face.

# **📌 Points to Note**

📝

The application should be built using the MERN stack (MongoDB, Express.js, React.js, Node.js) or an equivalent modern web stack.

The platform should be fully responsive and provide an excellent experience across desktop, tablet, and mobile devices.

Core marketplace workflows should function end-to-end.

Proper database design and API architecture are expected.

Authentication and role-based access control should be implemented.

Code should be modular, maintainable, and follow good engineering practices.

UI/UX quality will be an important evaluation criterion.

Participants are encouraged to use AI-powered development tools (such as GitHub Copilot, Cursor, Claude Code, ChatGPT, etc.) to improve productivity during development.

Product thinking, engineering quality, scalability, performance, and overall user experience will carry more weight than the total number of implemented features.

Creativity is highly encouraged. Teams are welcome to implement additional marketplace features that improve usability and overall product experience, provided the core functionality is completed first.

# 📤 Submission Instructions

## Required Submission

### 1. Demo Video

Walk through your entire product. 

### 2. Functional Web Application

Live deployed website URL 

---

## Source Code

**Source code submission is strictly not required.**

---

## Submission Group

**The Telegram submission group will be attached here.**

Link:→ https://t.me/+VaU8376NL1ZhOWI9

---

# 🏆 **Prizes and Opportunities**

- 🥇 **Hackathon Winner**:
    - The most functional and user-friendly platform creator will receive a **full-time job offer** as a **founding member with a high CTC and base pay**.
- 🎖️ **Certificates**:
    - Participants with functional MVPs, even if not winners, will receive **certificates of appreciation** if their submissions are liked by the founders.
- 🎖️ Prizes:
    - Depending on the submissions, prizes may be distributed to the top 3 winners. The prize consideration depends upon team and will be shared later.

---

# 🌟 Closing Note

This hackathon is more than a challenge it’s a chance to **shape your future** while working on one of the most **advanced projects** out there.

It’s a test for your **dedication and obsession** towards your role not just how much you know, but how much you’re willing to figure out.

It’s a **test of skills over resumes** in the era of AI, you’re **completely free to use any AI tool** to do this assignment. What matters is how smartly you use it and how much ownership you show.

We want to work with **people who enjoy challenges**, the ones who keep pushing even when things break, and **don’t stop until it finally works.**

Once you’re onboard, you’ll be working with a **team of geniuses** and on some seriously exciting stuff. But before that, you’ve got to **prove you’re the right fit** for this role.

So yeah thank you for being here, and all the very best for this Hackathon!!

We’re looking forward to connecting/working with the person who can ultimately get recognized as an winner of this challenge.

Also, to those who stay till the end and give it their best shot but ultimately don’t end up winning, we’ll be giving a **Certificate of Appreciation** for their **hard work, consistency, determination, and dedication. Cheers and ALL THE BEST!!!** 😉🔥.