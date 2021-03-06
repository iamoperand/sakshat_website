'use strict'

const Database = use('Database')
const User = use('App/Model/User')
const Project = use('App/Model/Project')
const ProjectOwner = use('App/Model/ProjectOwner')
const OrganisationProject = use('App/Model/OrganisationProject')
const ProjectDoc = use('App/Model/ProjectDoc')
const ProjectPaymentAccount = use('App/Model/ProjectPaymentAccount')
const ProjectBill = use('App/Model/ProjectBill')
const Transaction = use('App/Model/Transaction')
const Organisation = use('App/Model/Organisation')
const Volunteer = use('App/Model/Volunteer')
const Donator = use('App/Model/Donator')
const OrganisationOwner = use('App/Model/OrganisationOwner')
const Helpers = use('Helpers')
const fs = use('fs')
const Env = use('Env')
const moment = use('moment')

class ProfileController {
  * index (request,response) {
    let user = yield User.find(request.currentUser.id)

    user = user.toJSON()

    let allOrganisations = yield Organisation.query().with('organisation').orderBy('created_at', 'desc').fetch()
    response.ok(allOrganisations)


    return
  }

  * addProject (request, response) {

    let user = yield User.find(request.currentUser.id)

    user = user.toJSON()

    let allOrganisationsData = yield OrganisationOwner.query().where('user_id', user.id).with('organisation').orderBy('created_at', 'desc').fetch()

    let organisations = []
    if(allOrganisationsData) {
      allOrganisationsData = allOrganisationsData.toJSON()

      for (let i = 0; i < allOrganisationsData.length; i++) {
        organisations.push(allOrganisationsData[i].organisation)
      }
    }

    let independentOrganisation = yield Organisation.findBy('name', 'Independent')

    if(independentOrganisation) {
      independentOrganisation = independentOrganisation.toJSON()
      organisations.splice(0, 0, independentOrganisation)
    }

    // response.ok(organisations)

    yield response.sendView('project.add', {
      user: user,
      organisations: organisations
    })
    return
  }

  * addPostProject (request, response) {

    // user_id
    // organisation_id

    // project_name
    // project_description
    // project_purpose
    // project_tagline
    // project_image

    // need_volunteers
    // volunteers_number
    // need_fund
    // fund_amount
    // timebound_bool
    // project_deadline

    let user = yield User.find(request.currentUser.id)

    user = user.toJSON()

    // Get all the input data
    let user_id = request.input('user_id')
    let organisation_id = request.input('organisation_id')

    const project = new Project()
    project.name = request.input('project_name')
    project.description = request.input('project_description')
    project.purpose = request.input('project_purpose')
    project.tagline = request.input('project_tagline')

    yield project.save()

    let registered_project = yield Project.findBy('name', request.input('project_name'))
    registered_project = registered_project.toJSON()

    let project_id = registered_project.id

    let image = null
    let imageName = null
    let imagePath = null
    let imageExt = null

    if (request.file('project_image') !== undefined && request.file('project_image') !== null && request.file('project_image') !== '' && request.file('project_image').clientSize() !== 0) {
      if (!fs.existsSync(Helpers.publicPath('img/storage/organisations/projects_' + project_id))) {
        fs.mkdirSync(Helpers.publicPath('img/storage/organisations/projects_' + project_id))
      }

      image = request.file('project_image', {
        maxSize: '10mb',
        allowedExtensions: ['jpg', 'png', 'jpeg', 'gif', 'webp']
      })

      imageName = `${new Date().getTime()}_${image.clientName()}`

      yield image.move(Helpers.publicPath('img/storage/organisations/projects_' + project_id), imageName)

      if (!image.moved()) {
        response.badRequest(image.errors())
        return
      }

      imagePath = Env.get('MANAGE_URL', 'localhost:4040') + 'img/storage/organisations/projects_' + project_id + '/' + imageName
      imageExt = image.extension()

      const affectedRows = yield Database
        .table('projects')
        .where('id', project_id)
        .update({ image: imagePath })
    }


    const projectOwner = new ProjectOwner()
    projectOwner.project_id = project_id
    projectOwner.user_id = user.id
    yield projectOwner.save()

    const organisationProject = new OrganisationProject()
    organisationProject.project_id = project_id
    organisationProject.organisation_id = organisation_id
    yield organisationProject.save()


    const project_doc = new ProjectDoc()
    project_doc.project_id = project_id
    project_doc.need_volunteers = request.input('need_volunteers') ? true : false
    project_doc.volunteers_number = request.input('volunteers_number') ? request.input('volunteers_number') : 0
    project_doc.need_fund = request.input('need_fund') ? true : false
    project_doc.fund_amount = request.input('fund_amount') ? request.input('fund_amount') : 0
    project_doc.timebound_bool = request.input('timebound_bool') ? true : false
    project_doc.fundraising_deadline = request.input('fundraising_deadline')
    project_doc.project_deadline = request.input('project_deadline')
    project_doc.updates_frequency = request.input('updates_frequency')

    yield project_doc.save()

    const project_payment_account = new ProjectPaymentAccount()
    project_payment_account.project_id = project_id
    project_payment_account.pan_number = request.input('pan_number')
    project_payment_account.mobile_number = request.input('mobile_number')
    project_payment_account.aadhaar_id_number = request.input('aadhaar_id_number')
    project_payment_account.upi_id = request.input('upi_id')
    project_payment_account.account_number = request.input('account_number')
    project_payment_account.ifsc_code = request.input('ifsc_code')


    yield project_payment_account.save()

    yield request
        .with({success: 'Project has been sent for offline verification! Come back after 48 hours...'})
        .flash()

    response.redirect('back')
    return
  }

  * viewProject (request,response) {
    let user = yield User.find(request.currentUser.id)
    user = user.toJSON()

    const id = request.param('id')

    let projectDetails = yield ProjectOwner.query().where('project_id', id).with('user','project').fetch()
    let projectDocs = yield ProjectDoc.query().where('project_id', id).fetch()
    let volunteers = yield Volunteer.query().where('project_id', id).with('user').fetch()
    let donators = yield Donator.query().where('project_id',id).with('user').fetch()
    let transactions = yield Transaction.query().with('user', 'project').fetch()

    projectDetails = projectDetails.toJSON()
    projectDocs = projectDocs.toJSON()
    volunteers = volunteers.toJSON()
    donators = donators.toJSON()
    transactions = transactions.toJSON()

    for (let i = 0; i < transactions.length; i++) {
      transactions[i].creation_date = moment(transactions[i].created_at).format('DD MMM, YYYY')
    }


    yield response.sendView('project.view', {
      user: user,
      projectDetails: projectDetails,
      projectDocs: projectDocs,
      volunteers: volunteers,
      donators: donators,
      transactions: transactions
    })
    return
  }

  * getProjects (request, response) {
    let user = yield User.find(request.currentUser.id)

    user = user.toJSON()

    let projects = yield Project.query().orderBy('created_at', 'desc').fetch()
    // response.ok(projects)

    yield response.sendView('project.index', {
      user: user,
      projects: projects
    })
    return
  }

  * getDonationPage (request, response) {
    let user = yield User.find(request.currentUser.id)

    user = user.toJSON()

    let project_id = request.param('id')

    yield response.sendView('project.donation', {
      user: user,
      project_id: project_id
    })
    return
  }

  * postDonate (request, response) {
    let user = yield User.find(request.currentUser.id)

    user = user.toJSON()

    let transaction_id = new Date().getTime()

    const transaction = new Transaction()
    transaction.transaction_id = transaction_id
    transaction.project_id = request.input('project_id')
    transaction.user_id = request.input('user_id')
    transaction.amount = request.input('amount')


    yield transaction.save()

    let trx = {}
    trx.transaction_id = transaction_id
    trx.amount = request.input('amount')

    const donator = new Donator()
    donator.project_id = request.input('project_id')
    donator.user_id = request.input('user_id')
    donator.amount = request.input('amount')

    yield donator.save()


    let alldata = yield OrganisationProject.query().where('project_id', request.input('project_id')).with('project', 'organisation').fetch()
    alldata = alldata.toJSON()
    // response.ok(alldata)
    yield response.sendView('project.receipt', {
      user: user,
      alldata: alldata,
      trx: trx
    })
    return
  }

  * getVolunteerPage (request, response) {
    let user = yield User.find(request.currentUser.id)

    user = user.toJSON()

    let project_id = request.param('id')

    yield response.sendView('project.volunteer', {
      user: user,
      project_id: project_id
    })
    return
  }

  * postVolunteer (request, response) {
    let user = yield User.find(request.currentUser.id)

    user = user.toJSON()

    const volunteer = new Volunteer()
    volunteer.project_id = request.input('project_id')
    volunteer.user_id = request.input('user_id')


    yield volunteer.save()

    yield request
          .with({success: 'You will be contacted soon!'})
          .flash()

    response.redirect('back')
    return
  }

  * uploadBill (request, response) {

    let user = yield User.find(request.currentUser.id)
    user = user.toJSON()

    // Get all the input data
    let project_id = request.param('id')

    const projectBill = new ProjectBill()
    projectBill.project_id = project_id
    projectBill.billAmount = request.input('billAmount')
    projectBill.expenseDescription = request.input('expenseDescription')

    yield projectBill.save()

    let project_bill = yield ProjectBill.findBy('project_id', project_id)
    project_bill = project_bill.toJSON()

    let project_bill_id = project_bill.id

    let image = null
    let imageName = null
    let imagePath = null
    let imageExt = null

    if (request.file('bill') !== undefined && request.file('bill') !== null && request.file('bill') !== '' && request.file('bill').clientSize() !== 0) {
      if (!fs.existsSync(Helpers.publicPath('img/storage/organisations/projects_bills' + project_id))) {
        fs.mkdirSync(Helpers.publicPath('img/storage/organisations/projects_bills' + project_id))
      }

      image = request.file('bill', {
        maxSize: '10mb',
        allowedExtensions: ['jpg', 'png', 'jpeg', 'gif', 'webp']
      })

      imageName = `${new Date().getTime()}_${image.clientName()}`

      yield image.move(Helpers.publicPath('img/storage/organisations/projects_bills_' + project_id), imageName)

      if (!image.moved()) {
        response.badRequest(image.errors())
        return
      }

      imagePath = Env.get('MANAGE_URL', 'localhost:4040') + 'img/storage/organisations/projects_bills_' + project_id + '/' + imageName
      imageExt = image.extension()

      const affectedRows = yield Database
        .table('project_bills')
        .where('id', project_id)
        .update({ bill: imagePath })
    }

    yield request
        .with({success: 'Bill uploaded successfully!'})
        .flash()

    response.redirect('back')
    return
  }

}

module.exports = ProfileController
