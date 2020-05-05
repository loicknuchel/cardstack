let poster = {
  type: "image",
  value: "star-wars-poster-main@2x.png",
  width: 230,
  height: 340,
  altText: "Star Wars: The Rise of Skywalker poster",
  title: "US Poster",
  created: "May 5, 2019",
};

let mpaaRating = {
  type: "dropdown",
  value: "PG-13",
  options: [
    { value: "G" },
    { value: "PG" },
    { value: "PG-13" },
    { value: "R" },
    { value: "NC-17" },
  ],
};

let genres = {
  id: 'genres',
  title: 'Genres',
  value: [
    { id: "action", title: "Action" },
    { id: "adventure", title: "Adventure" },
    { id: "fantasy", title: "Fantasy" },
  ]
};

export default {
  version1: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: Episode IX" },
    year: { type: "numeric", value: 2019 },
    releaseDate: { type: "date", value: 20191220 },
  },
  version2: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    runTime: { type: "time", hours: 2, minutes: 22 },
    releaseDate: { type: "date", value: 20191220 },
  },
  version3: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    year: { type: "numeric", value: 2019 },
    runTime: { type: "time", hours: 2, minutes: 22 },
    releaseDate: { type: "date", value: 20191220 },
    mpaaRating,
    genres,
  },
  version4: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    year: { type: "numeric", value: 2019 },
    poster,
    runTime: { type: "time", hours: 2, minutes: 22 },
    releaseDate: { type: "date", value: 20191220 },
    mpaaRating,
    genres,
    avgUserRating: { type: "numeric", value: 6.8 },
  },
  version5: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    year: { type: "numeric", value: 2019 },
    poster,
    avgUserRating: { type: "numeric", value: 6.8 },
    releaseDate: { type: "date", value: 20191220 },
    runTime: { type: "time", hours: 2, minutes: 22 },
    mpaaRating,
    genres,
    description: { type: "textarea", value: "The legendary conflict between the Jedi and the Sith reaches its peak bringing the Skywalker saga to its end." },
  },
  version6: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    year: { type: "numeric", value: 2019 },
    poster,
    avgUserRating: { type: "numeric", value: 6.8 },
    releaseDate: { type: "date", value: 20191220 },
    runTime: { type: "time", hours: 2, minutes: 22 },
    mpaaRating,
    genres,
    description: { type: "textarea", value: "The surviving members of the resistance face the First Order once again, and the legendary conflict between the Jedi and the Sith reaches its peak bringing the Skywalker saga to its end." },
  },
  version7: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    year: { type: "numeric", value: 2019 },
    poster,
    avgUserRating: { type: "numeric", value: 6.8 },
    mpaaRating,
    runTime: { type: "time", hours: 2, minutes: 22 },
    releaseDate: { type: "date", value: 20191220 },
    genres,
    description: { type: "textarea", value: "The surviving members of the resistance face the First Order once again, and the legendary conflict between the Jedi and the Sith reaches its peak bringing the Skywalker saga to its end." },
  },
  version8: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    year: { type: "numeric", value: 2019 },
    poster,
    avgUserRating: { type: "numeric", value: 6.8 },
    mpaaRating,
    runTime: { type: "time", hours: 2, minutes: 22 },
    releaseDate: { type: "date", value: 20191220 },
    genres,
    description: { type: "textarea", value: "The surviving members of the resistance face the First Order once again, and the legendary conflict between the Jedi and the Sith reaches its peak bringing the Skywalker saga to its end." },
  },
  version9: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    year: { type: "numeric", value: 2019 },
    poster,
    avgUserRating: { type: "numeric", value: 6.8 },
    mpaaRating,
    runTime: { type: "time", hours: 2, minutes: 22 },
    releaseDate: { type: "date", value: 20191220 },
    genres,
    description: { type: "textarea", value: "The surviving members of the resistance face the First Order once again, and the legendary conflict between the Jedi and the Sith reaches its peak bringing the Skywalker saga to its end." },
    cast: {
      id: 'cast',
      title: 'Cast',
      embeddedTitle: 'Actor Profiles',
      value: [
        {
          id: "carrie-fisher",
          title: "Carrie Fisher",
          detail: "Leia Organa",
          src: "carrie-fisher.png",
          firstName: "Carrie",
          lastName: "Fisher"
        },
        {
          id: "mark-hamill",
          title: "Mark Hamill",
          detail: "Luke Skywalker",
          src: "mark-hamill.png",
        },
        {
          id: "daisy-ridley",
          title: "Daisy Ridley",
          detail: "Rey",
          src: "daisy-ridley.png",
        },
      ],
    }
  },
  latest: {
    id: "star-wars-the-rise-of-skywalker",
    title: { value: "Star Wars: The Rise of Skywalker" },
    year: { type: "numeric", value: 2019 },
    poster: {
      type: "image",
      value: "star-wars-poster-main@2x.png",
      width: 230,
      height: 340,
      altText: "Star Wars: The Rise of Skywalker poster",
      title: "US Poster",
      created: "May 5, 2019",
    },
    avgUserRating: { type: "numeric", value: 6.8 },
    mpaaRating,
    runTime: { type: "time", hours: 2, minutes: 22 },
    releaseDate: { type: "date", value: 20191220 },
    genres,
    description: { type: "textarea", value: "The surviving members of the resistance face the First Order once again, and the legendary conflict between the Jedi and the Sith reaches its peak bringing the Skywalker saga to its end." },
    cast: {
      id: 'cast',
      title: 'Cast',
      embeddedTitle: 'Actor Profiles',
      value: [
        {
          id: "carrie-fisher",
          title: "Carrie Fisher",
          detail: "Leia Organa",
          src: "carrie-fisher.png",
          firstName: "Carrie",
          lastName: "Fisher"
        },
        {
          id: "mark-hamill",
          title: "Mark Hamill",
          detail: "Luke Skywalker",
          src: "mark-hamill.png",
        },
        {
          id: "daisy-ridley",
          title: "Daisy Ridley",
          detail: "Rey",
          src: "daisy-ridley.png",
        },
        {
          id: "adam-driver",
          title: "Adam Driver",
          detail: "Kylo Ren",
          src: "adam-driver.png",
        },
        {
          id: "john-boyega",
          title: "John Boyega",
          detail: "Finn",
          src: "john-boyega.png",
        },
        {
          id: "oscar-isaac",
          title: "Oscar Isaac",
          detail: "Poe Dameron",
          src: "oscar-isaac.png",
        },
        {
          id: "anthony-daniels",
          title: "Anthony Daniels",
          detail: "C-3PO",
          src: "anthony-daniels.png",
        },
        {
          id: "naomie-ackie",
          title: "Naomie Ackie",
          detail: "Jannah",
          src: "naomie-ackie.png",
        },
      ],
      columns: [
        {
          name: 'Name',
          valuePath: 'title',
          isFixed: 'left',
        },
        {
          name: 'Id',
          valuePath: 'id',
        },
        {
          name: 'Role',
          valuePath: 'detail'
        },
        {
          name: 'Image file',
          valuePath: 'src',
        },
      ],
    },
    photos: {
      id: 'photos',
      title: 'Photos',
      embeddedTitle: 'Photos',
      value: [
        { id: "sw1", src: "sw1.png", title: "Photo 001", detail: "May 5, 2019", },
        { id: "sw2", src: "sw2.png", title: "Photo 002", detail: "May 5, 2019", },
        { id: "sw3", src: "sw3.png", title: "Photo 003", detail: "May 5, 2019", },
        { id: "sw4", src: "sw4.png", title: "Photo 004", detail: "May 5, 2019", },
        { id: "sw5", src: "sw5.png", title: "Photo 005", detail: "May 5, 2019", },
      ],
      columns: [
        {
          name: 'Title',
          valuePath: 'title',
          isFixed: 'left',
          width: 165
        },
        {
          name: 'Id',
          valuePath: 'id'
        },
        {
          name: 'Date created',
          valuePath: 'detail'
        },
        {
          name: 'File',
          valuePath: 'src'
        }
      ]
    },
  }
}
