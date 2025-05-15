const data = [
    {
        "title": "paste.ly (Bit.ly replica)",
        "description": "Self project for Backend service immitate bit.ly for generating short URL and files uploader. pastely is the core service for handling requests from client either to translate the short URL or generating short URL with capabilites to handle 50 million read requests and 5 million write request per month. Build on top of Go and go mod for dependencies manager, Echo for its web framework, GORM as its ORM, PostgreSQL as its database, Redis for cache deployed with Helm.",
        "image": "./assets/gopher.jpeg",
        "year": "2025",
        "role": "Software Engineer Backend",
        "github": "https://github.com"
    },

    {
        "title": "Galary",
        "description": "This project was developed in collaboration with an event organizer and concert promoters to provide fans with personalized photos taken during the event, along with exclusive digital artworks themed around the concert. These digital items are designed to be unique and collectible, allowing fans to preserve and relive their concert experience in a creative and meaningful way.",
        "image": "./assets/python.png",
        "year": "2025",
        "role": "Software Engineer Backend",
        "github": "https://github.com"
    }
]

document.addEventListener('DOMContentLoaded', function () {
    const pSection = document.getElementById('project-section')
    let s = `
            <h2 class="header-featured-project">Featured Project</h2>
            <p class="header-desc-featured-project">Here's some selected projects that showcase my passion for software
                engineering.</p> \n
    `

    for (const p of data) {
        s += `
                    <div class="project-showcase-container">
                        <figure class="project-showcase-image">
                            <img src="${p.image}" alt="" class="image-project-showcase">
                        </figure>
                        <div class="project-desc">

                            <p class="title-featured-project">${p.title} </p>
                            <p class="desc-featured-project">${p.description}</p>
                            <p class="desc-project-info">Project Info</p>
                            <div class="year-project-info">
                                <p class="desc-project-info">Year</p>
                                <p class="desc-project-info">${p.year}</p>

                            </div>
                            <hr class="divider" style="margin-top: 0.8rem; margin-bottom: 0.8rem" />

                            <div class="role-project-info">
                                <p class="desc-project-info">Role</p>
                                <p class="desc-project-info">${p.role}</p>

                            </div>

                            <hr class="divider" style="margin-top: 0.8rem; margin-bottom: 0.8rem" />



                            <div
                                class="button-project-info">
                                <a href="${p.github}" class="contact-button-other" target="_blank">
                                    <i class="fa-brands fa-github"></i>
                                </a>
                            </div>


                        </div>
                    </div>
                `
    }

    pSection.innerHTML = s
});

